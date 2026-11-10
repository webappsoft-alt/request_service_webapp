"use client";

import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileText, ImageIcon, Loader2, Mail, MapPin, PenLine, Phone } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { EstimatePdfDocument } from "@/components/estimate/estimate-pdf";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EventCalendar, EventCalendarSkeleton, eventTimes, type CalendarMove } from "@/components/portal/event-calendar";
import { lineTotal, type JobCostLine } from "@/components/portal/use-job-costing";
import type { EstimateApproval, EstimateShareSnapshot } from "@/components/portal/use-estimate-share";
import type { RouteLocationMapInnerProps } from "@/components/portal/route-location-map-inner";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import { getJob, getRequest, listRecordSchedule, updateSchedule } from "@/lib/api/crm-client";
import type { EstimateV2Opportunity, OpportunityAttachment } from "@/lib/api/estimate-v2-client";
import {
  invoiceStatusLabel,
  invoiceStatusTone,
  jobStatusLabel,
  jobStatusTone,
  windowFromMinutes,
  type PortalCalendarEvent,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { stageDateRange, stageDisplayStatus, stageProgress, stageStatusLabel, stageStatusTone } from "@/lib/project-stages";
import type { Estimate, Invoice, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The route map (business → job site), the same one as the "View on map" dialog, inline. */
const RouteMap = dynamic(() => import("@/components/portal/route-location-map-inner").then((mod) => mod.RouteLocationMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500 dark:bg-muted/40">Loading map…</div>
  ),
});

/** The sidebar sections that render here, in the centre (no page change). */
export const PROJECT_PANEL_VIEWS = [
  "customer",
  "request",
  "preview",
  "selections",
  "budget",
  "progress",
  "change-orders",
  "schedule",
  "invoices",
  "files",
] as const;
export type ProjectPanelView = (typeof PROJECT_PANEL_VIEWS)[number];

export function isProjectPanelView(view: string): view is ProjectPanelView {
  return (PROJECT_PANEL_VIEWS as readonly string[]).includes(view);
}

/** Same surface as the estimate page's own cards (RAIL_CARD). */
const PANEL_CARD =
  "rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_6px_16px_-8px_rgba(15,23,42,0.10)] dark:border-border dark:bg-card";

/** Same eyebrow as the estimate page's SectionLabel. */
function PanelLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{children}</h2>
      {aside ? <span className="text-[11px] font-medium text-slate-400 tabular-nums">{aside}</span> : null}
    </div>
  );
}

function Panel({ label, aside, children, className }: { label: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(PANEL_CARD, className)}>
      <PanelLabel aside={aside}>{label}</PanelLabel>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-muted/40">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-[15px] font-semibold tracking-tight text-slate-900 tabular-nums dark:text-foreground",
          tone === "good" && "text-emerald-700 dark:text-emerald-300",
          tone === "bad" && "text-rose-700 dark:text-rose-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

/** Who signed, and when — the approval status of an estimate. */
export function ApprovalStatus({ estimate }: { estimate: Estimate | null }) {
  const customer = estimate?.signature;
  const company = estimate?.companySignature;
  const accepted = estimate?.status === "accepted" || estimate?.status === "converted_to_job";
  if (!accepted && !customer?.signedBy && !company?.signedBy) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 text-sm",
        accepted
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
          : "border-slate-200/60 bg-white dark:border-border dark:bg-card",
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <BadgeCheck className={cn("size-4", accepted ? "text-emerald-600" : "text-muted-foreground")} />
        {accepted ? "Accepted by the customer" : "Awaiting the customer's signature"}
      </p>
      {customer?.signedBy ? (
        <p className="flex items-center gap-1.5">
          <PenLine className="size-3.5 opacity-70" />
          Customer: <span className="font-medium">{customer.signedBy}</span>
          {customer.signedAt ? <span className="opacity-70">· {formatDate(customer.signedAt)}</span> : null}
        </p>
      ) : null}
      {company?.signedBy ? (
        <p className="flex items-center gap-1.5">
          <PenLine className="size-3.5 opacity-70" />
          Company: <span className="font-medium">{company.signedBy}</span>
          {company.signedAt ? <span className="opacity-70">· {formatDate(company.signedAt)}</span> : null}
        </p>
      ) : null}
      {accepted ? <p className="w-full text-xs opacity-80">Signed estimates are locked: they can&apos;t be edited or sent again.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Project data: what the sidebar needs to know which sections have anything to show.
 * ---------------------------------------------------------------------------------------------- */

export type ProjectData = {
  job: Job | null;
  jobLoading: boolean;
  /** Photos the customer sent with the original request. */
  customerPhotos: string[];
  customerPhotosLoading: boolean;
  /** This project's rows on the company calendar (lead, estimate and job). */
  schedule: PortalCalendarEvent[];
  scheduleLoading: boolean;
  setSchedule: Dispatch<SetStateAction<PortalCalendarEvent[]>>;
  reloadSchedule: () => void;
};

type Keyed<T> = { key: string; value: T };

/** Loads the job, the customer's request photos and the calendar rows once per project. */
export function useProjectData({
  estimateId,
  jobId,
  requestId,
}: {
  estimateId?: string | null;
  jobId?: string | null;
  requestId?: string | null;
}): ProjectData {
  const [job, setJob] = useState<Keyed<Job | null> | null>(null);
  useEffect(() => {
    if (!jobId || job?.key === jobId) return;
    let cancelled = false;
    void getJob(jobId).then(
      (value) => !cancelled && setJob({ key: jobId, value }),
      () => !cancelled && setJob({ key: jobId, value: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [jobId, job?.key]);

  const [photos, setPhotos] = useState<Keyed<string[]> | null>(null);
  useEffect(() => {
    if (!requestId || photos?.key === requestId) return;
    let cancelled = false;
    void getRequest(requestId).then(
      (request) => !cancelled && setPhotos({ key: requestId, value: request?.photoUrls || [] }),
      () => !cancelled && setPhotos({ key: requestId, value: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [requestId, photos?.key]);

  const [nonce, setNonce] = useState(0);
  const recordIds = [requestId, estimateId, jobId].filter((id): id is string => Boolean(id));
  const scheduleKey = `${recordIds.join("|")}#${nonce}`;
  const [rows, setRows] = useState<Keyed<PortalCalendarEvent[]> | null>(null);
  useEffect(() => {
    if (!recordIds.length || rows?.key === scheduleKey) return;
    let cancelled = false;
    void Promise.all(recordIds.map((id) => listRecordSchedule(id).catch(() => [] as PortalCalendarEvent[]))).then((lists) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const merged = lists.flat().filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
      setRows({ key: scheduleKey, value: merged });
    });
    return () => {
      cancelled = true;
    };
    // recordIds is derived from scheduleKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey, rows?.key]);

  const setSchedule = useCallback<Dispatch<SetStateAction<PortalCalendarEvent[]>>>(
    (next) =>
      setRows((current) => {
        const value = current?.value || [];
        return { key: current?.key || scheduleKey, value: typeof next === "function" ? next(value) : next };
      }),
    [scheduleKey],
  );

  return {
    job: jobId && job?.key === jobId ? job.value : null,
    jobLoading: Boolean(jobId && job?.key !== jobId),
    customerPhotos: requestId && photos?.key === requestId ? photos.value : [],
    customerPhotosLoading: Boolean(requestId && photos?.key !== requestId),
    schedule: rows?.value || [],
    scheduleLoading: Boolean(recordIds.length && !rows),
    setSchedule,
    reloadSchedule: () => setNonce((n) => n + 1),
  };
}

type FileRow = { key: string; url: string; name: string; by: "Customer" | "Company" | "Site visit" | "Job" };

/** Every file on the project, labelled by who added it (also counted for the sidebar). */
export function projectFiles({
  customerPhotos,
  companyFiles,
  estimate,
  opportunity,
  job,
}: {
  customerPhotos: string[];
  companyFiles: OpportunityAttachment[];
  estimate: Estimate | null;
  opportunity: EstimateV2Opportunity;
  job: Job | null;
}): FileRow[] {
  const rows: FileRow[] = [];
  const seen = new Set<string>();
  const add = (url: string | undefined, name: string, by: FileRow["by"]) => {
    const clean = String(url || "").trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    rows.push({ key: `${by}-${rows.length}`, url: clean, name: fileName(clean, name), by });
  };
  customerPhotos.forEach((url, i) => add(url, `Request photo ${i + 1}`, "Customer"));
  companyFiles.forEach((file, i) => add(file.url, file.name || `File ${i + 1}`, "Company"));
  (estimate?.attachments || []).forEach((item, i) =>
    typeof item === "string" ? add(item, `Attachment ${i + 1}`, "Company") : add(item.attachment, item.name || `Attachment ${i + 1}`, "Company"),
  );
  (opportunity.siteAssessments || []).forEach((visit) =>
    (visit.photos || []).forEach((photo, i) => add(photo.url, photo.caption || `Visit photo ${i + 1}`, "Site visit")),
  );
  (job?.attachments || []).forEach((url, i) => add(url, `Job file ${i + 1}`, "Job"));
  return rows;
}

const BY_TONE: Record<FileRow["by"], string> = {
  Customer: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  Company: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-muted dark:text-foreground dark:ring-border",
  "Site visit": "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
  Job: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
};

const BY_LABEL: Record<FileRow["by"], string> = {
  Customer: "Uploaded by customer",
  Company: "Added by company",
  "Site visit": "Site visit",
  Job: "Job",
};

function isImage(url: string) {
  return /^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|avif|heic|svg)(\?|$)/i.test(url);
}

function fileName(url: string, fallback: string) {
  try {
    const last = decodeURIComponent(new URL(url, "https://x").pathname.split("/").pop() || "");
    return last && !/^data:/i.test(url) ? last : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------------------------------------
 * The panel switch.
 * ---------------------------------------------------------------------------------------------- */

export function ProjectPanel({
  view,
  data,
  estimate,
  opportunity,
  lines,
  onLinesChange,
  locked,
  preview,
  linkedInvoice,
  companyFiles,
  onOpenEstimate,
  onShowMap,
  mapProps,
  printButton,
  onSend,
  canSend,
}: {
  view: ProjectPanelView;
  data: ProjectData;
  estimate: Estimate | null;
  opportunity: EstimateV2Opportunity;
  lines: JobCostLine[];
  onLinesChange: (lines: JobCostLine[]) => void;
  locked: boolean;
  /** The customer document built from the sheet (null without line items). */
  preview: { snapshot: EstimateShareSnapshot; approval?: EstimateApproval } | null;
  linkedInvoice: Invoice | null;
  /** Files the company added under Existing information. */
  companyFiles: OpportunityAttachment[];
  onOpenEstimate: () => void;
  onShowMap: () => void;
  /** Business and job-site details for the Customer tab map. */
  mapProps: RouteLocationMapInnerProps;
  /** Print / PDF, shown on the Preview card. */
  printButton?: ReactNode;
  onSend: () => void;
  canSend: boolean;
}) {
  const { job } = data;
  const needsJob = view === "progress" || view === "change-orders";
  if (needsJob && data.jobLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading the job…
      </p>
    );
  }
  switch (view) {
    case "customer":
      return <CustomerPanel opportunity={opportunity} onShowMap={onShowMap} mapProps={mapProps} />;
    case "request":
      return <RequestPanel opportunity={opportunity} />;
    case "preview":
      return <PreviewPanel estimate={estimate} preview={preview} onSend={onSend} canSend={canSend} onOpenEstimate={onOpenEstimate} printButton={printButton} />;
    case "selections":
      return <SelectionsPanel lines={lines} onLinesChange={onLinesChange} locked={locked} />;
    case "budget":
      return <BudgetPanel lines={lines} job={job} />;
    case "progress":
      return <ProgressPanel job={job} estimate={estimate} />;
    case "change-orders":
      return <ChangeOrdersPanel job={job} />;
    case "schedule":
      return <SchedulePanel data={data} />;
    case "invoices":
      return <InvoicesPanel invoice={linkedInvoice} job={job} />;
    case "files":
      return <FilesPanel data={data} opportunity={opportunity} estimate={estimate} companyFiles={companyFiles} />;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Panels.
 * ---------------------------------------------------------------------------------------------- */

function customerOf(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return { id: typeof c === "string" ? c : "", name: "Customer", email: "", phone: "" };
  const name = String(c.companyName || "").trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || "Customer";
  return { id: String(c.id || c._id || ""), name, email: String(c.email || "").trim(), phone: String(c.phone || "").trim() };
}

function CustomerPanel({
  opportunity,
  onShowMap,
  mapProps,
}: {
  opportunity: EstimateV2Opportunity;
  onShowMap: () => void;
  mapProps: RouteLocationMapInnerProps;
}) {
  const customer = customerOf(opportunity);
  const p = opportunity.propertyAddress || {};
  const address = [p.address || p.street, p.city, p.state, p.zip].filter(Boolean).join(", ");
  return (
    <Panel label="Customer & property">
      <p className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-foreground">{customer.name}</p>
      <dl className="mt-3 grid gap-2.5 text-sm sm:grid-cols-2">
        {customer.email ? (
          <div className="flex items-center gap-2 text-slate-700 dark:text-foreground">
            <Mail className="size-4 shrink-0 text-slate-400" />
            <dt className="sr-only">Email</dt>
            <dd className="min-w-0 truncate">
              <a href={`mailto:${customer.email}`} className="hover:text-primary hover:underline">
                {customer.email}
              </a>
            </dd>
          </div>
        ) : null}
        {customer.phone ? (
          <div className="flex items-center gap-2 text-slate-700 dark:text-foreground">
            <Phone className="size-4 shrink-0 text-slate-400" />
            <dt className="sr-only">Phone</dt>
            <dd>
              <a href={`tel:${customer.phone}`} className="hover:text-primary hover:underline">
                {customer.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {address ? (
          <div className="flex items-start gap-2 text-slate-700 sm:col-span-2 dark:text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <dt className="sr-only">Property</dt>
            <dd>
              {address}{" "}
              <button
                type="button"
                onClick={onShowMap}
                className="ml-1 text-xs font-bold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                View on map
              </button>
            </dd>
          </div>
        ) : null}
      </dl>
      {customer.id ? (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-border-soft">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
            <Link href={`/pro/dashboard/customers/${customer.id}`}>
              <ExternalLink className="size-3.5 text-primary" /> Customer profile
            </Link>
          </Button>
        </div>
      ) : null}
      {address ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Route to the job site</p>
          <RouteMap {...mapProps} />
        </div>
      ) : null}
    </Panel>
  );
}

function RequestPanel({ opportunity }: { opportunity: EstimateV2Opportunity }) {
  const answers = (opportunity.quoteAnswers || []).filter((answer) => answer.label && answer.value);
  return (
    <Panel label="Work request">
      {opportunity.categoryName ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="inline-flex rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">
            {opportunity.categoryName}
          </p>
          {opportunity.subcategoryName ? (
            <p className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-slate-600 uppercase dark:bg-muted">
              {opportunity.subcategoryName}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-foreground">{opportunity.title}</p>
      {opportunity.description ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-muted-foreground">{opportunity.description}</p>
      ) : null}
      {answers.length ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2.5 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2 dark:border-border-soft">
          {answers.map((answer, i) => (
            <div key={answer.id || i}>
              <dt className="text-xs text-slate-500">{answer.label}</dt>
              <dd className="font-medium text-slate-800 dark:text-foreground">{answer.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Panel>
  );
}

function PreviewPanel({
  estimate,
  preview,
  onSend,
  canSend,
  onOpenEstimate,
  printButton,
}: {
  estimate: Estimate | null;
  preview: { snapshot: EstimateShareSnapshot; approval?: EstimateApproval } | null;
  onSend: () => void;
  canSend: boolean;
  onOpenEstimate: () => void;
  printButton?: ReactNode;
}) {
  if (!preview) {
    return (
      <Panel label="Preview">
        <Muted>
          Add line items to preview the estimate.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={onOpenEstimate}>
            Go to the estimate
          </button>
        </Muted>
      </Panel>
    );
  }
  return (
    <div className="space-y-3">
      <ApprovalStatus estimate={estimate} />
      <Panel
        label="Preview · as the customer sees it"
        aside={
          <span className="flex items-center gap-2">
            {printButton}
            {canSend ? (
              <Button size="sm" className="h-8" onClick={onSend}>
                Review and send
              </Button>
            ) : null}
          </span>
        }
      >
        <div className="overflow-x-auto rounded-xl bg-slate-100 p-3 dark:bg-muted/40">
          <div className="mx-auto w-full max-w-204 min-w-160 bg-white shadow-sm">
            <EstimatePdfDocument snapshot={preview.snapshot} approval={preview.approval} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SelectionsPanel({
  lines,
  onLinesChange,
  locked,
}: {
  lines: JobCostLine[];
  onLinesChange: (lines: JobCostLine[]) => void;
  locked: boolean;
}) {
  const filled = lines.filter((line) => line.description.trim() || Number(line.unitPrice) > 0);
  const optional = filled.filter((line) => line.optional);
  const byGroup = new Map<string, JobCostLine[]>();
  for (const line of optional) {
    const key = line.optionGroup?.trim() || "Other options";
    byGroup.set(key, [...(byGroup.get(key) || []), line]);
  }
  const included = filled.filter((line) => !line.optional).reduce((sum, line) => sum + lineTotal(line), 0);
  const optionalTotal = optional.reduce((sum, line) => sum + lineTotal(line), 0);

  const include = (id: string) => {
    if (locked) return;
    onLinesChange(lines.map((line) => (line.id === id ? { ...line, optional: false, optionGroup: "" } : line)));
  };

  return (
    <Panel label="Selections" aside={`${optional.length} optional`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Stat label="Included in the total" value={formatMoney(included)} />
        <Stat label="Optional (not in the total)" value={formatMoney(optionalTotal)} />
      </div>
      <div className="mt-4 space-y-4">
        {[...byGroup.entries()].map(([group, rows]) => (
          <div key={group}>
            <p className="text-xs font-medium text-slate-500">Option for: {group}</p>
            <ul className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200/70 dark:divide-border-soft dark:border-border">
              {rows.map((line) => (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-foreground">{line.description || "Option"}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {line.quantity} {line.unit} × {formatMoney(line.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(lineTotal(line))}</span>
                    {locked ? null : (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => include(line.id)}>
                        Include in total
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {locked ? <p className="mt-3 text-xs text-slate-500">This estimate is signed, so its selections are locked.</p> : null}
    </Panel>
  );
}

function BudgetPanel({ lines, job }: { lines: JobCostLine[]; job: Job | null }) {
  const included = lines.filter((line) => !line.optional && (line.description.trim() || Number(line.unitPrice) > 0));
  const hasCost = (line: JobCostLine) => line.unitCost != null && Number.isFinite(Number(line.unitCost));
  const withCost = included.filter(hasCost);
  const price = included.reduce((sum, line) => sum + lineTotal(line), 0);
  const pricedWithCost = withCost.reduce((sum, line) => sum + lineTotal(line), 0);
  const cost = withCost.reduce((sum, line) => sum + Math.round(Number(line.quantity) * Number(line.unitCost) * 100) / 100, 0);
  const profit = pricedWithCost - cost;
  const margin = pricedWithCost > 0 ? Math.round((profit / pricedWithCost) * 1000) / 10 : null;
  const approvedChanges = (job?.changeOrders || []).filter((order) => order.status === "approved");
  const changeTotal = approvedChanges.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  const bySection = new Map<string, { price: number; cost: number; costed: number }>();
  for (const line of included) {
    const key = line.section?.trim() || "General";
    const row = bySection.get(key) || { price: 0, cost: 0, costed: 0 };
    row.price += lineTotal(line);
    if (hasCost(line)) {
      row.cost += Number(line.quantity) * Number(line.unitCost);
      row.costed += lineTotal(line);
    }
    bySection.set(key, row);
  }

  return (
    <Panel label="Budget" aside="Internal · never shown to the customer">
      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Price" value={formatMoney(price)} />
        <Stat label="Your cost" value={withCost.length ? formatMoney(cost) : "—"} />
        <Stat label="Profit" value={withCost.length ? formatMoney(profit) : "—"} tone={withCost.length ? (profit >= 0 ? "good" : "bad") : undefined} />
        <Stat label="Margin" value={margin != null ? `${margin}%` : "—"} />
      </div>
      {withCost.length < included.length ? (
        <p className="mt-2 text-xs text-slate-500">
          {included.length - withCost.length} of {included.length} lines have no cost yet. Add a cost on the estimate to see their profit.
        </p>
      ) : null}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/70 dark:border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-muted/40">
            <tr className="text-left text-[10px] tracking-[0.12em] text-slate-500 uppercase">
              <th className="px-3 py-2 font-semibold">Section</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 text-right font-semibold">Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-border-soft">
            {[...bySection.entries()].map(([section, row]) => (
              <tr key={section}>
                <td className="px-3 py-2 font-medium text-slate-900 dark:text-foreground">{section}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.costed ? formatMoney(row.cost) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.costed ? formatMoney(row.costed - row.cost) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {approvedChanges.length ? (
        <p className="mt-3 text-sm text-slate-700 dark:text-foreground">
          Approved change orders add <span className="font-semibold tabular-nums">{formatMoney(changeTotal)}</span> · project price{" "}
          <span className="font-semibold tabular-nums">{formatMoney(price + changeTotal)}</span>
        </p>
      ) : null}
    </Panel>
  );
}

const JOB_STEPS: { label: string; statuses: string[] }[] = [
  { label: "Booked", statuses: ["unscheduled", "scheduled", "dispatched", "en_route", "on_site", "on_hold", "waiting_parts", "needs_return"] },
  { label: "In progress", statuses: ["in_progress"] },
  { label: "Completed", statuses: ["completed"] },
];

function ProgressPanel({ job, estimate }: { job: Job | null; estimate: Estimate | null }) {
  if (!job) {
    return (
      <Panel label="Progress">
        <Muted>The job couldn&apos;t be loaded.</Muted>
      </Panel>
    );
  }
  const stepIndex = Math.max(0, JOB_STEPS.findIndex((step) => step.statuses.includes(job.status)));
  const stages = estimate?.stages || [];
  return (
    <div className="space-y-3">
      <Panel
        label="Progress"
        aside={<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", jobStatusTone(job.status))}>{jobStatusLabel(job.status)}</span>}
      >
        <p className="text-sm text-slate-700 dark:text-foreground">
          <span className="font-semibold">{job.number}</span> {job.title ? `· ${job.title}` : ""}
        </p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {JOB_STEPS.map((step, index) => (
            <li key={step.label}>
              <div className={cn("h-1.5 rounded-full", index <= stepIndex ? "bg-primary" : "bg-slate-200 dark:bg-muted")} />
              <p className={cn("mt-1.5 text-xs", index <= stepIndex ? "font-semibold text-slate-900 dark:text-foreground" : "text-slate-500")}>
                {step.label}
              </p>
            </li>
          ))}
        </ol>
      </Panel>
      {stages.length ? (
        <Panel label="Stages" aside={`${stageProgress(stages)}% done`}>
          <ul className="divide-y divide-slate-100 dark:divide-border-soft">
            {stages.map((stage) => {
              const status = stageDisplayStatus(stage);
              return (
                <li key={stage.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate font-medium">{stage.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                    {stageDateRange(stage)}
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", stageStatusTone(status))}>{stageStatusLabel(status)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      {job.activities?.length ? (
        <Panel label="Latest activity">
          <ol className="relative space-y-0 border-l border-slate-200 pl-4 dark:border-border-soft">
            {job.activities.slice(0, 5).map((item) => (
              <li key={item.id} className="relative pb-3 last:pb-0">
                <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-primary bg-white" />
                <p className="text-sm font-medium text-slate-900 dark:text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}

function ChangeOrdersPanel({ job }: { job: Job | null }) {
  const orders = job?.changeOrders || [];
  return (
    <Panel label="Change orders" aside={String(orders.length)}>
      <ul className="divide-y divide-slate-100 dark:divide-border-soft">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                {order.number} {order.title ? <span className="font-normal">· {order.title}</span> : null}
              </p>
              {order.description ? <p className="line-clamp-1 text-xs text-slate-500">{order.description}</p> : null}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize dark:bg-muted">
                {order.status.replace(/_/g, " ")}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(Number(order.total) || 0)}</span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** This project's visits and job dates on the company calendar — the same calendar as Schedule. */
function SchedulePanel({ data }: { data: ProjectData }) {
  const { employees, employeeLabel, assign } = usePortalCrew();
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const { schedule, setSchedule, reloadSchedule } = data;

  async function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    const before = eventTimes(event);
    const sameTimes = move.startMinutes === before.start && move.endMinutes === before.end;
    const timeWindow = (sameTimes && event.timeWindow) || windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow;
    setSchedule((rows) =>
      rows.map((row) =>
        row.id === event.id
          ? {
              ...row,
              date: move.date,
              endDate: move.endDate,
              startMinutes: move.startMinutes ?? row.startMinutes,
              endMinutes: move.endMinutes ?? row.endMinutes,
              timeWindow,
            }
          : row,
      ),
    );
    try {
      const saved = await updateSchedule(event.id, {
        date: move.date,
        endDate: move.endDate ?? null,
        startMinutes: move.startMinutes,
        endMinutes: move.endMinutes,
        timeWindow,
      });
      if (saved) setSchedule((rows) => rows.map((row) => (row.id === event.id ? { ...row, ...saved } : row)));
      toast.success(`${event.title} moved to ${formatDate(move.date)}.`);
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not move it on the schedule.");
      reloadSchedule();
    }
  }

  return (
    <Panel label="Schedule" aside={schedule.length ? `${schedule.length} on the calendar` : undefined}>
      {data.scheduleLoading ? (
        <EventCalendarSkeleton />
      ) : (
        <EventCalendar
          events={schedule}
          employees={employees}
          employeeLabel={employeeLabel}
          onMove={moveEvent}
          onEventOpen={setEditing}
        />
      )}
      <AssignEventDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        event={editing}
        events={schedule}
        employees={employees}
        onSave={async (assignment) => {
          await assign(assignment);
          setEditing(null);
          reloadSchedule();
        }}
      />
    </Panel>
  );
}

function InvoicesPanel({ invoice, job }: { invoice: Invoice | null; job: Job | null }) {
  const changeInvoices = (job?.changeOrders || []).filter((order) => order.billingInvoiceId);
  return (
    <div className="space-y-3">
      {invoice ? (
        <Panel
          label={`Invoice · ${invoice.number}`}
          aside={
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", invoiceStatusTone(invoice.status))}>
              {invoiceStatusLabel(invoice.status)}
            </span>
          }
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="Total" value={formatMoney(invoice.total)} />
            <Stat label="Paid" value={formatMoney(invoice.amountPaid || 0)} tone={invoice.amountPaid ? "good" : undefined} />
            <Stat label="Balance" value={formatMoney(invoice.balanceDue || 0)} tone={invoice.balanceDue > 0 ? "bad" : undefined} />
            <Stat label="Due" value={invoice.dueAt ? formatDate(invoice.dueAt) : "—"} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
              <Link href={`/pro/dashboard/invoices/${invoice.id}`}>
                <ExternalLink className="size-3.5 text-primary" /> Record a payment or send
              </Link>
            </Button>
          </div>
        </Panel>
      ) : null}
      {changeInvoices.length ? (
        <Panel label="Change order invoices" aside={String(changeInvoices.length)}>
          <ul className="divide-y divide-slate-100 dark:divide-border-soft">
            {changeInvoices.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <span>
                  {order.billingInvoiceNumber || "Invoice"} <span className="text-slate-500">· {order.number}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(Number(order.total) || 0)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function FilesPanel({
  data,
  opportunity,
  estimate,
  companyFiles,
}: {
  data: ProjectData;
  opportunity: EstimateV2Opportunity;
  estimate: Estimate | null;
  companyFiles: OpportunityAttachment[];
}) {
  const rows = projectFiles({ customerPhotos: data.customerPhotos, companyFiles, estimate, opportunity, job: data.job });
  const counts = rows.reduce<Partial<Record<FileRow["by"], number>>>((acc, row) => ({ ...acc, [row.by]: (acc[row.by] || 0) + 1 }), {});
  const present = (Object.keys(BY_LABEL) as FileRow["by"][]).filter((by) => counts[by]);

  return (
    <Panel label="Project files" aside={String(rows.length)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {present.map((by) => (
          <span key={by} className={cn("rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset", BY_TONE[by])}>
            {BY_LABEL[by]} · {counts[by]}
          </span>
        ))}
        {data.customerPhotosLoading ? (
          <span className="flex items-center gap-1 text-slate-500">
            <Loader2 className="size-3 animate-spin" /> Loading the customer&apos;s photos…
          </span>
        ) : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <li key={row.key}>
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-xl border border-slate-200/70 bg-white transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-border dark:bg-card"
            >
              <div className="flex aspect-4/3 items-center justify-center bg-slate-100 dark:bg-muted">
                {isImage(row.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.url} alt={row.name} className="size-full object-cover" loading="lazy" />
                ) : (
                  <FileText className="size-8 text-slate-400" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                  {isImage(row.url) ? <ImageIcon className="size-3 shrink-0 text-slate-400" /> : null}
                  <span className="truncate">{row.name}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset", BY_TONE[row.by])}>{row.by}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
