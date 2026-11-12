"use client";

import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, BadgeCheck, Check, Clock3, ExternalLink, FileText, FolderOpen, Hash, ImageIcon, Loader2, Mail, MapPin, PenLine, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { EstimatePdfDocument } from "@/components/estimate/estimate-pdf";
import { invoiceBoardColumns } from "@/components/portal/invoice-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EventCalendar, EventCalendarSkeleton, eventTimes, type CalendarMove } from "@/components/portal/event-calendar";
import { lineTotal, type JobCostLine } from "@/components/portal/use-job-costing";
import type { EstimateApproval, EstimateShareSnapshot } from "@/components/portal/use-estimate-share";
import type { RouteLocationMapInnerProps } from "@/components/portal/route-location-map-inner";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { JobRequestsTab } from "@/components/portal/job-requests-tab";
import { JobChangeOrdersPanel } from "@/components/portal/job-change-orders-panel";
import { listContractorReviewRequests } from "@/lib/api/contractor-portal-client";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { getInvoice, getJob, getRequest, listRecordSchedule, updateSchedule } from "@/lib/api/crm-client";
import type { EstimateV2Opportunity, OpportunityAttachment } from "@/lib/api/estimate-v2-client";
import { estimateStatusLabel, opportunityStatusLabel, opportunityStatusTone } from "@/lib/data/estimate-v2-status";
import {
  jobStatusLabel,
  jobStatusTone,
  windowFromMinutes,
  type PortalCalendarEvent,
} from "@/lib/data/portal";
import { formatDateTime, formatDate, formatMoney } from "@/lib/format";
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
  "requests",
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
  "rounded-2xl border border-[#94a3b8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card";

/** Same eyebrow as the estimate page's SectionLabel. */
function PanelLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{children}</h2>
      {/* Text asides are muted; buttons keep their own colours. */}
      {aside ? (
        typeof aside === "string" ? <span className="text-[11px] font-medium text-slate-400 tabular-nums">{aside}</span> : aside
      ) : null}
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/40">
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

/**
 * A name in the status banner that opens its page (job, customer, company). Client: it should look
 * clickable and keep moving: the arrow nudges up-right and a faint underline breathes on a loop; on
 * hover the underline is full. Keyframes: `.rs-banner-link` / `.rs-banner-link-arrow` in globals.css.
 */
function BannerLink({ href, children, title }: { href: string; children: ReactNode; title?: string }) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "rs-banner-link inline-flex items-center gap-0.5 rounded-sm font-semibold text-primary dark:text-sky-300",
        "bg-[linear-gradient(currentColor,currentColor)] bg-[length:35%_1px] bg-bottom-left bg-no-repeat",
        "transition-colors hover:text-primary/90",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {children}
      <ArrowUpRight aria-hidden className="rs-banner-link-arrow size-3.5" />
    </Link>
  );
}

/** Who signed, and when — the approval status of an estimate. */
export function ApprovalStatus({
  estimate,
  jobNumber,
  opportunity,
  actions,
}: {
  estimate: Estimate | null;
  jobNumber?: string;
  /** Before an estimate exists, the lead's status is shown (client: the status always sits in this bar). */
  opportunity?: EstimateV2Opportunity | null;
  /** Buttons on the right of the bar (e.g. Assign technician, Print). */
  actions?: ReactNode;
}) {
  const customer = estimate?.signature;
  const company = estimate?.companySignature;
  const status = estimate?.status || "";
  const accepted = status === "accepted" || status === "converted_to_job";
  // Client: always show the status here (never in the sidebar). Parts with no data are left out.
  const statusText = estimate?.status
    ? estimateStatusLabel(estimate.status)
    : opportunity?.status
      ? opportunityStatusLabel(opportunity.status)
      : "";
  if (!statusText && !accepted) return null;
  // Client: every status gets a tinted bar like the green one; only the colour changes.
  const leadStatus = estimate?.status ? "" : String(opportunity?.status || "");
  const tone: "success" | "info" | "warning" | "danger" | "neutral" | "progress" = accepted || leadStatus === "won"
    ? "success"
    : status === "sent" || leadStatus === "estimate_sent"
      ? "info"
      : status === "changes_requested"
        ? "warning"
        : status === "rejected" || status === "expired" || leadStatus === "lost"
          ? "danger"
          : leadStatus === "assessment_scheduled" || leadStatus === "assessment_completed" || leadStatus === "new"
            ? "progress"
            : "neutral";
  const note = accepted
    ? "Signed estimates are locked: they can't be edited or sent again."
    : status === "sent"
      ? "Waiting for the customer to review and sign."
      : status === "changes_requested"
        ? "The customer asked for changes. Update the estimate and send it again."
        : status === "rejected"
          ? "The customer declined this estimate."
          : status === "expired"
            ? "This estimate expired before the customer signed it."
            : estimate?.id
              ? "Not sent to the customer yet."
              : leadStatus === "assessment_scheduled"
                ? "A site visit is booked. Complete it, then build the estimate."
                : leadStatus === "assessment_completed"
                  ? "The site visit is done. Build the estimate from what was found."
                  : leadStatus === "new"
                    ? "New lead. Choose how to prepare the estimate."
                    : leadStatus === "lost"
                      ? "This lead was marked as lost."
                      : leadStatus === "won"
                        ? "The customer accepted."
                        : "No estimate yet.";
  const StatusIcon = accepted ? BadgeCheck : tone === "warning" || tone === "danger" ? AlertCircle : Clock3;
  // Client: job, customer and company names open their pages.
  const customerHref = estimate?.customerId ? `/pro/dashboard/customers/${estimate.customerId}` : "";
  const companyHref = "/pro/dashboard/settings";
  const customerName = (name: string) =>
    customerHref ? (
      <BannerLink href={customerHref} title="Open the customer">
        {name}
      </BannerLink>
    ) : (
      <span className="font-semibold">{name}</span>
    );
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 text-sm",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
        tone === "info" && "border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
        tone === "warning" && "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
        tone === "danger" && "border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
        tone === "progress" && "border-indigo-200 bg-indigo-50/70 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100",
        tone === "neutral" && "border-slate-300 bg-slate-100/70 text-slate-900 dark:border-border dark:bg-muted/40 dark:text-foreground",
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
        <StatusIcon
          className={cn(
            "size-4",
            tone === "success" && "text-emerald-600",
            tone === "info" && "text-sky-600",
            tone === "warning" && "text-amber-600",
            tone === "danger" && "text-rose-600",
            tone === "progress" && "text-indigo-600",
            tone === "neutral" && "text-slate-500",
          )}
        />
        {status === "converted_to_job" ? (
          estimate?.jobId ? (
            // Client: the job number opens the job.
            <span className="inline-flex items-center gap-1">
              Converted to job
              <BannerLink href={`/pro/dashboard/jobs/${estimate.jobId}`} title="Open the job">
                {jobNumber || "Open job"}
              </BannerLink>
            </span>
          ) : (
            `Converted to job${jobNumber ? ` ${jobNumber}` : ""}`
          )
        ) : accepted ? (
          "Accepted"
        ) : (
          statusText
        )}
        {accepted ? (
          <span className="font-normal">
            · accepted by {customer?.signedBy ? customerName(customer.signedBy) : "the customer"}
            {customer?.signedAt ? <span className="opacity-70"> · {formatDate(customer.signedAt)}</span> : null}
          </span>
        ) : null}
      </p>
      {customer?.signedBy && !accepted ? (
        <p className="flex items-center gap-1.5">
          <PenLine className="size-3.5 opacity-70" />
          Customer: {customerName(customer.signedBy)}
          {customer.signedAt ? <span className="opacity-70">· {formatDate(customer.signedAt)}</span> : null}
        </p>
      ) : null}
      {company?.signedBy ? (
        <p className="flex items-center gap-1.5">
          <PenLine className="size-3.5 opacity-70" />
          Company:{" "}
          <BannerLink href={companyHref} title="Open your business profile">
            {company.signedBy}
          </BannerLink>
          {company.signedAt ? <span className="opacity-70">· {formatDate(company.signedAt)}</span> : null}
        </p>
      ) : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
      {note ? <p className="w-full text-xs opacity-80">{note}</p> : null}
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
  /** Change order / completion requests from the job's technicians and contractors. */
  jobRequests: { total: number; pending: number };
  /** The request counts have loaded at least once (before that they read 0). */
  jobRequestsLoaded: boolean;
  /** Load the job again (after a request becomes a change order). */
  reloadJob: () => void;
  /** Show a job the API just returned (e.g. after a change order is created or approved). */
  replaceJob: (job: Job) => void;
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
  const [jobNonce, setJobNonce] = useState(0);
  const jobKey = jobId ? `${jobId}#${jobNonce}` : "";
  useEffect(() => {
    if (!jobId || job?.key === jobKey) return;
    let cancelled = false;
    void getJob(jobId).then(
      (value) => !cancelled && setJob({ key: jobKey, value }),
      () => !cancelled && setJob((current) => ({ key: jobKey, value: current?.value ?? null })),
    );
    return () => {
      cancelled = true;
    };
  }, [jobId, jobKey, job?.key]);

  // Requests from the job's crew (all + waiting for review). The socket bumps `version` so it stays live.
  const requestsVersion = useAppSelector((state) => state.contractorReviews.version);
  const [requests, setRequests] = useState<Keyed<{ total: number; pending: number }> | null>(null);
  const requestsKey = jobId ? `${jobId}#${requestsVersion}#${jobNonce}` : "";
  useEffect(() => {
    if (!jobId || requests?.key === requestsKey) return;
    let cancelled = false;
    void Promise.all([
      listContractorReviewRequests({ jobId, status: "all", page: 1, limit: 1 }),
      listContractorReviewRequests({ jobId, status: "pending_pro_approval", page: 1, limit: 1 }),
    ]).then(
      ([all, pending]) => !cancelled && setRequests({ key: requestsKey, value: { total: all.total, pending: pending.total } }),
      () => !cancelled && setRequests({ key: requestsKey, value: { total: 0, pending: 0 } }),
    );
    return () => {
      cancelled = true;
    };
  }, [jobId, requestsKey, requests?.key]);

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
    // Keep showing the loaded job while it reloads (reloadJob).
    job: jobId && job?.key.startsWith(`${jobId}#`) ? job.value : null,
    jobLoading: Boolean(jobId && !job?.key.startsWith(`${jobId}#`)),
    customerPhotos: requestId && photos?.key === requestId ? photos.value : [],
    customerPhotosLoading: Boolean(requestId && photos?.key !== requestId),
    schedule: rows?.value || [],
    scheduleLoading: Boolean(recordIds.length && !rows),
    setSchedule,
    reloadSchedule: () => setNonce((n) => n + 1),
    jobRequests: requests?.value || { total: 0, pending: 0 },
    jobRequestsLoaded: Boolean(requests),
    reloadJob: () => setJobNonce((n) => n + 1),
    replaceJob: (next: Job) => setJob({ key: jobKey, value: next }),
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
  onView,
  estimateTechnician,
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
  /** Open another section of this page (e.g. Change requests from the Job tab). */
  onView?: (view: string) => void;
  /** Technician assigned on this estimate (shown on the Job tab when the job has no crew of its own). */
  estimateTechnician?: string;
  onShowMap: () => void;
  /** Business and job-site details for the Customer tab map. */
  mapProps: RouteLocationMapInnerProps;
  /** Print / PDF, shown on the Preview card. */
  printButton?: ReactNode;
  onSend: () => void;
  canSend: boolean;
}) {
  const { job } = data;
  const needsJob = view === "progress" || view === "change-orders" || view === "requests";
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
      return (
        <RequestPanel
          opportunity={opportunity}
          photos={data.customerPhotos}
          onShowMap={onShowMap}
          onOpenFiles={onView ? () => onView("files") : undefined}
        />
      );
    case "preview":
      return <PreviewPanel estimate={estimate} preview={preview} onSend={onSend} canSend={canSend} onOpenEstimate={onOpenEstimate} printButton={printButton} />;
    case "selections":
      return <SelectionsPanel lines={lines} onLinesChange={onLinesChange} locked={locked} />;
    case "budget":
      return <BudgetPanel lines={lines} job={job} />;
    case "progress":
      return <ProgressPanel job={job} estimate={estimate} pendingRequests={data.jobRequests.pending} onView={onView} estimateTechnician={estimateTechnician} />;
    case "requests":
      return job ? (
        <section className={PANEL_CARD}>
          {/* Same table as the job's Requests tab (approve / reject, create the change order). */}
          <JobRequestsTab
            // Client: clearly not the same as Change orders.
            title="Change requests"
            description="Requests from your technicians and contractors for extra work or materials. Approving one adds it to Scope changes; declining it closes the request."
            jobId={job.id}
            changeOrders={job.changeOrders || []}
            onChangeOrderCreated={() => data.reloadJob()}
            // Any decision changes the sidebar's "N new" count. An approved change order already
            // reloads through onChangeOrderCreated, so only the other decisions reload here.
            onDecided={(request) => {
              if (!(request.type === "change_order" && request.status !== "rejected")) data.reloadJob();
            }}
          />
        </section>
      ) : null;
    case "change-orders":
      // Client: the full Change Orders tab of the job page (summary tiles, cards with lines, create /
      // approve), not a short list. Same props and lock rule as the job page.
      // return <ChangeOrdersPanel job={job} />;
      return job ? (
        <section className={PANEL_CARD}>
          {/* Client: keep Change orders and Change requests apart. */}
          <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
            Scope changes are the extra work added to this job (change orders). Requests sent by your technicians and contractors are
            under{" "}
            {onView ? (
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onView("requests")}>
                Change requests
              </button>
            ) : (
              <span className="font-semibold">Change requests</span>
            )}
            ; approving one adds it here.
          </p>
          <JobChangeOrdersPanel
            job={job}
            originalAmount={(job.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0)}
            invoiceId={linkedInvoice?.id || job.invoiceId}
            locked={Boolean(linkedInvoice || job.invoiceId) || ["completed", "invoiced", "paid"].includes(job.status)}
            onJobUpdated={(next) => data.replaceJob(next)}
          />
        </section>
      ) : null;
    case "schedule":
      return <SchedulePanel data={data} />;
    case "invoices":
      return <InvoicesPanel invoice={linkedInvoice} job={job} estimate={estimate} opportunity={opportunity} />;
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

const SOURCE_LABEL: Record<string, string> = {
  manual: "Created directly",
  request: "Customer request",
  lead: "Customer request",
  website: "Website",
  marketplace: "Marketplace",
  ai_receptionist: "AI receptionist",
  phone: "Phone call",
};

function sourceLabel(source?: string) {
  if (!source) return "";
  return SOURCE_LABEL[source] || source.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** One labelled fact in the request's detail grid. */
// Kept for the commented-out grids (Job tab, old Work request). 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Fact({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 gap-2.5 bg-white px-4 py-3 dark:bg-card">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium break-words text-slate-900 dark:text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** One label / value line in the Work request side column. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-slate-500 dark:text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-slate-900 dark:text-foreground">{children}</dd>
    </div>
  );
}

/** Small uppercase heading used inside the Work request card. */
function RequestHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-bold tracking-[0.08em] text-slate-900 uppercase dark:text-foreground">{children}</h3>
      {aside ? <span className="text-xs text-slate-500">{aside}</span> : null}
    </div>
  );
}

/** The customer's original request (client: one professional record card, not stacked boxes). */
function RequestPanel({
  opportunity,
  photos,
  onShowMap,
  onOpenFiles,
}: {
  opportunity: EstimateV2Opportunity;
  photos: string[];
  onShowMap: () => void;
  /** Open the Photos & files tab (every file on the project). */
  onOpenFiles?: () => void;
}) {
  const answers = (opportunity.quoteAnswers || []).filter((answer) => answer.label && answer.value);
  const customer = customerOf(opportunity);
  const p = opportunity.propertyAddress || {};
  const address = [p.address || p.street, p.city, p.state, p.zip].filter(Boolean).join(", ");
  const attachments = [
    ...photos.map((url) => ({ url, name: "" })),
    ...(opportunity.customerAttachments || []).map((file) => ({ url: file.url, name: file.name || "" })),
  ].filter((file, index, all) => file.url && all.findIndex((other) => other.url === file.url) === index);
  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i.test(url) || url.includes("/image");
  const initials =
    customer.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C";

  return (
    <div className="space-y-3">
      <section className={cn(PANEL_CARD, "overflow-hidden p-0")}>
        {/* Header: what this is, its status, and the two ways out. */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-border-soft">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Work request
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-normal normal-case", opportunityStatusTone(opportunity.status))}>
                {opportunityStatusLabel(opportunity.status)}
              </span>
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground">{opportunity.title}</h2>
            {opportunity.categoryName ? (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-muted-foreground">
                {opportunity.categoryName}
                {opportunity.subcategoryName ? ` › ${opportunity.subcategoryName}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {opportunity.requestId ? (
              <Button size="sm" variant="outline" className="h-9 gap-1.5" asChild>
                <Link href={`/pro/dashboard/requests/${opportunity.requestId}`}>
                  <ExternalLink className="size-3.5" /> Open lead
                </Link>
              </Button>
            ) : null}
            {customer.id ? (
              <Button size="sm" className="h-9 gap-1.5" asChild>
                <Link href={`/pro/dashboard/customers/${customer.id}`}>
                  <UserRound className="size-3.5" /> Customer profile
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Left: the request in the customer's words, then their answers. */}
          <div className="space-y-6 px-5 py-5">
            <div>
              <RequestHeading>Customer&apos;s request</RequestHeading>
              <blockquote className="border-l-[3px] border-primary/60 bg-slate-50 py-3 pr-4 pl-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 dark:bg-muted/30 dark:text-foreground">
                {opportunity.description?.trim() || "No description was given."}
              </blockquote>
            </div>

            {answers.length ? (
              <div>
                <RequestHeading aside={`${answers.length} question${answers.length === 1 ? "" : "s"}`}>Quote questions</RequestHeading>
                <dl className="divide-y divide-slate-200 rounded-xl border border-slate-300 dark:divide-border-soft dark:border-border">
                  {answers.map((answer, i) => (
                    <div key={answer.id || i} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-2 sm:gap-4">
                      <dt className="text-slate-500 dark:text-muted-foreground">{answer.label}</dt>
                      <dd className="font-medium text-slate-900 dark:text-foreground">{answer.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div>
              <RequestHeading
                aside={
                  onOpenFiles ? (
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={onOpenFiles}>
                      All project photos &amp; files →
                    </button>
                  ) : attachments.length ? (
                    String(attachments.length)
                  ) : undefined
                }
              >
                Photos &amp; files from the customer
              </RequestHeading>
              {attachments.length ? (
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {attachments.map((file) => (
                    <li key={file.url}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group block overflow-hidden rounded-xl border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-border dark:bg-card"
                      >
                        {isImage(file.url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={file.url} alt={file.name || "Customer photo"} className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <span className="flex aspect-[4/3] items-center justify-center bg-slate-50 dark:bg-muted/40">
                            <FileText className="size-6 text-slate-400" />
                          </span>
                        )}
                        {file.name ? <span className="block truncate px-2 py-1.5 text-xs text-slate-600 dark:text-muted-foreground">{file.name}</span> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-border">
                  The customer didn&apos;t send any photos or files with this request.
                </p>
              )}
            </div>

            <div>
              <RequestHeading aside="Not shown to the customer">Internal notes</RequestHeading>
              {opportunity.internalNotes?.trim() ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-foreground">
                  {opportunity.internalNotes}
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-border">No internal notes.</p>
              )}
            </div>
          </div>

          {/* Right: reference details, who it's for, and where. */}
          <aside className="space-y-6 border-t border-slate-200 bg-slate-50/60 px-5 py-5 lg:border-t-0 lg:border-l dark:border-border-soft dark:bg-muted/20">
            <div>
              <RequestHeading>Details</RequestHeading>
              <dl className="divide-y divide-slate-200 dark:divide-border-soft">
                <DetailRow label="Reference">{opportunity.number}</DetailRow>
                <DetailRow label="Received">{opportunity.createdAt ? formatDate(opportunity.createdAt) : "—"}</DetailRow>
                <DetailRow label="Source">{sourceLabel(opportunity.source) || "—"}</DetailRow>
                {opportunity.subcategoryName || opportunity.categoryName ? (
                  <DetailRow label="Service">{opportunity.subcategoryName || opportunity.categoryName}</DetailRow>
                ) : null}
              </dl>
            </div>

            <div>
              <RequestHeading>Customer</RequestHeading>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-foreground">{customer.name}</p>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-primary dark:text-muted-foreground">
                      <Phone className="size-3" aria-hidden /> {customer.phone}
                    </a>
                  ) : null}
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 truncate text-xs text-slate-600 hover:text-primary dark:text-muted-foreground">
                      <Mail className="size-3" aria-hidden /> {customer.email}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <RequestHeading>Service address</RequestHeading>
              <p className="flex gap-2 text-sm text-slate-800 dark:text-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                {address || "No address yet"}
              </p>
              {address ? (
                <Button type="button" size="sm" variant="outline" className="mt-2 h-8 w-full gap-1.5" onClick={onShowMap}>
                  <MapPin className="size-3.5" /> View on map
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      {/* Customer answers now sit inside the card above (client: one record, not stacked boxes).
      {answers.length ? (
        <Panel label="Customer answers" ...>…</Panel>
      ) : null} */}

      {/* Photos & files and Internal notes moved inside the card above (client). */}
    </div>
  );
}

function PreviewPanel({
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
            <ul className="mt-1.5 divide-y divide-slate-200 rounded-xl border border-slate-300 dark:divide-border-soft dark:border-border">
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
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 dark:border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-300 bg-slate-50 dark:border-border dark:bg-muted/40">
            <tr className="text-left text-[10px] tracking-[0.12em] text-slate-500 uppercase">
              <th className="px-3 py-2 font-semibold">Section</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 text-right font-semibold">Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-border-soft">
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
  { label: "Booked", statuses: ["unscheduled"] },
  { label: "Scheduled", statuses: ["scheduled", "dispatched", "en_route"] },
  { label: "In progress", statuses: ["on_site", "in_progress", "on_hold", "waiting_parts", "needs_return"] },
  { label: "Completed", statuses: ["completed"] },
  { label: "Invoiced", statuses: ["invoiced", "paid"] },
];

/** The job made from this estimate: where it stands, when, who, how much — and a way into the job. */
function ProgressPanel({
  job,
  estimate,
  pendingRequests = 0,
  onView,
  estimateTechnician = "",
}: {
  job: Job | null;
  estimate: Estimate | null;
  pendingRequests?: number;
  onView?: (view: string) => void;
  estimateTechnician?: string;
}) {
  const { employeeLabel } = usePortalCrew();
  if (!job) {
    return (
      <Panel label="Job">
        <Muted>The job couldn&apos;t be loaded.</Muted>
      </Panel>
    );
  }
  const cancelled = job.status === "cancelled";
  const stepIndex = Math.max(0, JOB_STEPS.findIndex((step) => step.statuses.includes(job.status)));
  const stages = estimate?.stages || [];
  // Crew names: the team list first, then the name saved on the job (team list not loaded yet),
  // then the technician assigned on this estimate (job made before a technician was copied over).
  const technicianIds = [...new Set([...(job.assignedEmployeeIds || []), job.assignedEmployeeId].filter(Boolean) as string[])];
  const crewNames = technicianIds.map((id) => employeeLabel(id)).filter(Boolean);
  const technicians = crewNames.length
    ? crewNames
    : technicianIds.length && job.assignedTo
      ? [job.assignedTo]
      : estimateTechnician && estimateTechnician !== "Assigned technician"
        ? [estimateTechnician]
        : technicianIds.length
          ? [job.assignedTo || "Assigned technician"]
          : [];
  const contractors = (job.crewContractors || []).map((row) => row.name).filter(Boolean);
  const baseValue = (job.items || []).filter((item) => item.source !== "change_order").reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const approved = (job.changeOrders || []).filter((order) => order.status === "approved");
  const extras = approved.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const a = job.address;
  const address = a ? [a.address || a.street, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";

  return (
    <div className="space-y-3">
      <section className={cn(PANEL_CARD, "overflow-hidden p-0")}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-border-soft">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Job</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground">
              {job.number}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", jobStatusTone(job.status))}>{jobStatusLabel(job.status)}</span>
            </p>
            {job.title ? <p className="mt-0.5 text-sm text-slate-600 dark:text-muted-foreground">{job.title}</p> : null}
          </div>
          <Button size="sm" className="h-9 gap-1.5" asChild>
            <Link href={`/pro/dashboard/jobs/${job.id}`}>
              <ExternalLink className="size-3.5" /> Open job
            </Link>
          </Button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-4">
          {cancelled ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              This job was cancelled.
            </p>
          ) : (
            <ol className="flex items-start">
              {JOB_STEPS.map((step, index) => {
                const done = index < stepIndex;
                const current = index === stepIndex;
                return (
                  <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className={cn("absolute top-3.5 right-1/2 h-0.5 w-full", index <= stepIndex ? "bg-primary" : "bg-slate-200 dark:bg-muted")}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-[1] flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary bg-white text-primary ring-4 ring-primary/15 dark:bg-card",
                        !done && !current && "border-slate-300 bg-white text-slate-400 dark:border-border dark:bg-card",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 text-[11px] sm:text-xs",
                        current ? "font-semibold text-slate-900 dark:text-foreground" : done ? "text-slate-700 dark:text-foreground" : "text-slate-400",
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Facts in the project's own table (PortalDataTable, same as Invoices / Change requests). */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-border-soft">
          <PortalDataTable
            filename={`job-${job.number || job.id}`}
            countLabel="Job"
            hideSearch
            rows={[job]}
            rowKey={(row) => row.id}
            columns={[
              {
                id: "scheduled",
                header: "Start date",
                exportValue: (row) => (row.scheduledAt ? formatDateTime(row.scheduledAt) : "Not scheduled yet"),
                cell: (row) => (row.scheduledAt ? formatDateTime(row.scheduledAt) : "Not scheduled yet"),
              },
              {
                id: "due",
                header: "Due date",
                exportValue: (row) => (row.dueAt ? formatDate(row.dueAt) : ""),
                cell: (row) => (row.dueAt ? formatDate(row.dueAt) : "—"),
              },
              {
                id: "crew",
                header: "Assigned crew",
                exportValue: () => [...technicians, ...contractors].join(", "),
                cell: () =>
                  technicians.length || contractors.length ? (
                    <>
                      {technicians.join(", ")}
                      {contractors.length ? (
                        <span className="block text-xs text-slate-500">Contractors: {contractors.join(", ")}</span>
                      ) : null}
                    </>
                  ) : (
                    "Nobody assigned"
                  ),
              },
              {
                id: "value",
                header: "Job total",
                exportValue: () => formatMoney(baseValue + extras),
                cell: () => (
                  <span className="tabular-nums">
                    {formatMoney(baseValue + extras)}
                    {approved.length ? (
                      <span className="block text-xs text-slate-500">
                        incl. {approved.length} approved change order{approved.length === 1 ? "" : "s"} ({formatMoney(extras)})
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                id: "invoice",
                header: "Invoice status",
                exportValue: (row) => (row.invoiceId ? "Invoiced" : "Created when the work is complete"),
                cell: (row) =>
                  row.invoiceId ? (
                    <Link href={`/pro/dashboard/invoices/${row.invoiceId}`} className="font-medium text-primary hover:underline">
                      Open invoice
                    </Link>
                  ) : (
                    "Created when the work is complete"
                  ),
              },
              {
                id: "site",
                header: "Job address",
                exportValue: () => address,
                cell: () => address || "—",
              },
            ]}
          />
        </div>
        {/* Was a grid of boxes (client asked for a table):
        <dl className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-border-soft dark:bg-border-soft">
          <Fact icon={CalendarClock} label="Scheduled">
            {job.scheduledAt ? formatDateTime(job.scheduledAt) : "Not scheduled yet"}
          </Fact>
          <Fact icon={CalendarDays} label="Due">
            {job.dueAt ? formatDate(job.dueAt) : "—"}
          </Fact>
          <Fact icon={HardHat} label="Crew">
            {technicians.length || contractors.length ? (
              <>
                {technicians.join(", ")}
                {contractors.length ? (
                  <span className="block text-xs font-normal text-slate-500">Contractors: {contractors.join(", ")}</span>
                ) : null}
              </>
            ) : (
              "Nobody assigned"
            )}
          </Fact>
          <Fact icon={Wallet} label="Job value">
            {formatMoney(baseValue + extras)}
            {approved.length ? (
              <span className="block text-xs font-normal text-slate-500">
                incl. {approved.length} approved change order{approved.length === 1 ? "" : "s"} ({formatMoney(extras)})
              </span>
            ) : null}
          </Fact>
          <Fact icon={Receipt} label="Invoice">
            {job.invoiceId ? (
              <Link href={`/pro/dashboard/invoices/${job.invoiceId}`} className="text-primary hover:underline">
                Open invoice
              </Link>
            ) : (
              "Created when the work is complete"
            )}
          </Fact>
          <Fact icon={MapPin} label="Job site">
            {address || "—"}
          </Fact>
        </dl> */}
      </section>

      {pendingRequests ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4" />
            {pendingRequests} change request{pendingRequests === 1 ? "" : "s"} from the crew waiting for your review
          </p>
          {onView ? (
            <Button size="sm" variant="outline" className="h-8 border-amber-400 bg-white" onClick={() => onView("requests")}>
              Review
            </Button>
          ) : null}
        </div>
      ) : null}

      {stages.length ? (
        <Panel label="Stages" aside={`${stageProgress(stages)}% done`}>
          <ul className="divide-y divide-slate-200 dark:divide-border-soft">
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
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}

// Kept for reference: the old short list (replaced by JobChangeOrdersPanel, client).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ChangeOrdersPanel({ job }: { job: Job | null }) {
  const orders = job?.changeOrders || [];
  return (
    <Panel label="Change orders" aside={String(orders.length)}>
      <ul className="divide-y divide-slate-200 dark:divide-border-soft">
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

/**
 * This project's invoices (the estimate's invoice + change-order invoices) in the same table as the
 * Invoices page (client: a table, not the document).
 */
function InvoicesPanel({
  invoice,
  job,
  estimate,
  opportunity,
}: {
  invoice: Invoice | null;
  job: Job | null;
  estimate: Estimate | null;
  opportunity: EstimateV2Opportunity;
}) {
  const changeIds = (job?.changeOrders || []).map((order) => order.billingInvoiceId).filter((id): id is string => Boolean(id));
  const changeKey = changeIds.join(",");
  const [changeInvoices, setChangeInvoices] = useState<{ key: string; rows: Invoice[] } | null>(null);
  useEffect(() => {
    if (!changeKey) return;
    let cancelled = false;
    void Promise.all(changeKey.split(",").map((id) => getInvoice(id).catch(() => null))).then((rows) => {
      if (!cancelled) setChangeInvoices({ key: changeKey, rows: rows.filter((row): row is Invoice => Boolean(row)) });
    });
    return () => {
      cancelled = true;
    };
  }, [changeKey]);
  const loadingChanges = Boolean(changeKey) && changeInvoices?.key !== changeKey;
  const rows = [
    ...(invoice ? [invoice] : []),
    ...(changeKey && changeInvoices?.key === changeKey ? changeInvoices.rows : []),
  ].filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);

  const customer = customerOf(opportunity);
  const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const paid = rows.reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0);
  const balance = rows.reduce((sum, row) => sum + (Number(row.balanceDue) || 0), 0);

  return (
    <Panel label="Invoices" aside={`${rows.length} invoice${rows.length === 1 ? "" : "s"}`}>
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Invoiced" value={formatMoney(total)} />
        <Stat label="Paid" value={formatMoney(paid)} tone={paid ? "good" : undefined} />
        <Stat label="Balance due" value={formatMoney(balance)} tone={balance > 0 ? "bad" : undefined} />
      </div>
      <div className="mt-4">
        <PortalDataTable
          filename="project-invoices"
          countLabel="Invoices"
          searchPlaceholder="Search by invoice #"
          loading={loadingChanges && !rows.length}
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
          empty="No invoices yet."
          columns={invoiceBoardColumns({
            jobs: job ? [job] : [],
            estimates: estimate ? [estimate] : [],
            requests: [],
            customerName: () => customer.name,
            customerAddress: () => opportunity.propertyAddress,
          })}
          actions={(row) => [
            { label: "View", href: `/pro/dashboard/invoices/${row.id}` },
            ...(row.balanceDue > 0 ? [{ label: "Record a payment", href: `/pro/dashboard/invoices/${row.id}` }] : []),
            ...(row.jobId ? [{ label: "Open job", href: `/pro/dashboard/jobs/${row.jobId}` }] : []),
          ]}
        />
      </div>
    </Panel>
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
    <Panel label="Photos & files" aside={rows.length ? String(rows.length) : undefined}>
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
      {!rows.length && !data.customerPhotosLoading ? (
        <div className="mt-1 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-border">
          <FolderOpen className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-foreground">No photos or files yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Everything on this project shows here: photos the customer sent with the request, files you add under
            Existing information, site-visit photos and job photos.
          </p>
        </div>
      ) : null}
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <li key={row.key}>
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-xl border border-slate-300 bg-white transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-border dark:bg-card"
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
