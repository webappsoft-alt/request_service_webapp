"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Eye,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Music,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  extractUploadedUrl,
  uploadAnyFile,
  validateAttachmentFile,
} from "@/components/api/uploadFile";
import {
  GoogleAddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/google-address-autocomplete";
import { JobCosting, JobCostChart, JobCostLegend, type CostingNoun, type JobCostingActions } from "@/components/portal/job-costing";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { useEstimateActivities } from "@/components/portal/use-estimate-activities";
import { useJobActivities } from "@/components/portal/use-job-activities";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { UsStateSelect } from "@/components/shared/us-state-select";
import { patchJobLocally } from "@/store/jobsSlice";
import { jobMoneySheet, lineTotal, useJobCosting, type JobCostLine } from "@/components/portal/use-job-costing";
import { formatTaxRatePercent } from "@/lib/tax/state-tax";
import {
  useJobFile,
  toJobAttachmentItem,
  type JobActivity,
  type JobAttachment,
  type JobLog,
  type JobSettingsDraft,
} from "@/components/portal/use-job-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getEstimate,
  updateEstimate as updateEstimateApi,
  updateEstimateAttachments,
  updateInvoiceAttachments,
  updateJobAttachments,
  assignSchedule,
  updateSchedule,
  resolveCrmObjectId,
} from "@/lib/api/crm-client";
import { estimateStatusLabel } from "@/lib/data/portal";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  fetchJobDetail,
  upsertJobItem,
  updateJobRecord,
} from "@/store/jobsSlice";
import { fetchTeam } from "@/store/teamSlice";
import { upsertInvoiceItem } from "@/store/invoicesSlice";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import { employeeName, jobStatusLabel, jobStatusTone, minutesForWindow } from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney, formatShortDate } from "@/lib/format";
import type { Estimate, Invoice, Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/portal/status-pill";

export function JobFileChrome({
  job,
  customer,
  customerLabel,
  service,
  estimate,
  invoice,
  start,
  due,
  technician,
}: {
  job: Job;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  estimate?: Estimate;
  invoice?: Invoice;
  start?: string;
  due?: string;
  technician: string;
}) {
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = job.address;
  const addressLine = [
    address.street,
    formatLocation(address.city, address.state, address.zip),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{customerLabel}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[customer?.phone, customer?.email].filter(Boolean).join(" · ") ||
              "Customer details for this job"}
          </p>
        </div>
        {job.customerId ? (
          <Button size="sm" variant="outline" className="h-8 border-border-soft" asChild>
            <Link href={`/pro/dashboard/customers/${job.customerId}`}>
              Open customer file
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-x-8 gap-y-3.5 px-1 py-1 sm:grid-cols-2">
        <Detail
          label="Customer"
          value={
            job.customerId ? (
              <Link
                href={`/pro/dashboard/customers/${job.customerId}`}
                className="font-semibold text-primary hover:underline"
              >
                {customerLabel}
              </Link>
            ) : (
              customerLabel
            )
          }
        />
        {customer && customer.entityKind === "company" && contact ? (
          <Detail label="Contact" value={contact} />
        ) : null}
        <Detail label="Phone" value={customer?.phone || "—"} />
        <Detail
          label="Email"
          value={
            customer?.email ? (
              <span className="text-primary">{customer.email}</span>
            ) : (
              "—"
            )
          }
        />
        <Detail label="Service" value={service || "—"} />
        <Detail label="Address" value={addressLine || "—"} />
        <Detail label="Team member" value={technician || "Unassigned"} />
        <Detail label="Start" value={start ? formatDate(start) : "Not scheduled"} />
        <Detail label="Due" value={due ? formatDate(due) : "—"} />
        <Detail
          label="Status"
          value={
            <span className="capitalize">{jobStatusLabel(job.status)}</span>
          }
        />
        {estimate ? (
          <Detail
            label="Source estimate"
            value={
              <Link
                href={`/pro/dashboard/new-estimate/${estimate.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {estimate.number}
                {estimate.title ? ` · ${estimate.title}` : ""}
              </Link>
            }
          />
        ) : null}
        {invoice ? (
          <Detail
            label="Invoice"
            value={
              <Link
                href={`/pro/dashboard/invoices/${invoice.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {invoice.number}
              </Link>
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function stamp(value?: string) {
  if (!value) return "Added recently";
  try {
    const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "Added recently";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Added recently";
  }
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeHtml(html: string) {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export function JobSummaryTab({
  job,
  estimate,
  invoice,
  technician,
  noun = "job",
  locked = false,
  customerLabel,
  siteAddress,
  quoteTotal,
  onActivitiesChange,
  onEditEstimate,
  notice,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  locked?: boolean;
  customerLabel?: string;
  siteAddress?: string;
  quoteTotal?: number;
  onActivitiesChange?: (next: Estimate["activities"]) => void;
  onEditEstimate?: () => void;
  notice?: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const { lines, mix } = useJobCosting(job, {
    // Estimates: prefer line items from the estimate record so Labor/Materials
    // kinds stay aligned with API (and labour spelling repairs), not stale localStorage.
    preferApi: noun === "job" || Boolean(estimate),
  });
  const { requests } = usePortalWorkspace();
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const addressState =
    estimate?.propertyAddress?.state ||
    job?.address?.state ||
    "";
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { fetchTaxRatePercent } = await import("@/lib/tax/state-tax");
      const rate = await fetchTaxRatePercent(addressState);
      if (!cancelled) setTaxRatePercent(rate);
    })();
    return () => {
      cancelled = true;
    };
  }, [addressState]);
  const sheet = jobMoneySheet(mix, taxRatePercent);
  const file = useJobFile(job, estimate, invoice, technician);
  const crm = useCrmApiData();
  const isEstimate = noun === "estimate" && Boolean(estimate?.id);
  const isJobRecord = noun === "job" && Boolean(job?.id);
  const estimateActivities = useEstimateActivities(
    estimate?.id,
    isEstimate,
    estimate?.activities,
    (next) => {
      if (estimate?.id) {
        crm.patchEstimate(estimate.id, { activities: next });
        onActivitiesChange?.(next);
      }
    },
  );
  const jobActivities = useJobActivities(
    job?.id,
    isJobRecord,
    job?.activities,
    (next) => {
      if (job?.id) {
        dispatch(patchJobLocally({ id: job.id, patch: { activities: next } }));
      }
    },
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; html: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const laborLines = lines.filter((line) => line.kind === "labor");
  const materialLines = lines.filter((line) => line.kind === "materials");

  const linkedRequest = useMemo(() => {
    const requestId = estimate?.requestId?.trim();
    if (!requestId) return null;
    return requests.find((item) => item.id === requestId) ?? null;
  }, [estimate?.requestId, requests]);

  const quoteAnswers = linkedRequest?.answers?.filter(
    (item) => item.label?.trim() && item.value?.trim(),
  ) ?? [];

  const jobSiteAddress = [
    job.address?.street,
    formatLocation(
      job.address?.city || "",
      job.address?.state || "",
      job.address?.zip,
    ),
  ]
    .filter(Boolean)
    .join(", ");

  const apiActivities = isEstimate
    ? estimateActivities
    : isJobRecord
      ? jobActivities
      : null;

  const activities: Array<{ id: string; title: string; html: string; actor: string; at: string }> =
    apiActivities
      ? apiActivities.activities
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((item) => ({
            id: item.id,
            title: item.title,
            html: item.description,
            actor: item.actor || "Desk",
            at: item.createdAt,
          }))
      : file.activities;

  const hasInvoice =
    Boolean(invoice) ||
    Boolean(job.invoiceId) ||
    job.status === "invoiced" ||
    job.status === "paid";
  const invoiceHref = invoice?.id
    ? `/pro/dashboard/invoices/${invoice.id}`
    : job.invoiceId
      ? `/pro/dashboard/invoices/${resolveCrmObjectId(job.invoiceId) || job.invoiceId}`
      : null;

  return (
    <div className="space-y-4">
      {!isEstimate ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-md border border-border-soft bg-[#f7f8fa] px-4 py-2 text-sm">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground">Customer:</span>
            {job.customerId ? (
              <Link
                href={`/pro/dashboard/customers/${job.customerId}`}
                className="truncate font-semibold text-primary hover:underline"
              >
                {customerLabel?.trim() || "View customer"}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">
                {customerLabel?.trim() || "—"}
              </span>
            )}
          </span>
          {(siteAddress || jobSiteAddress) ? (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
              <span className="text-muted-foreground">Site:</span>
              <span className="truncate font-medium text-foreground">
                {siteAddress || jobSiteAddress}
              </span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">Job total:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoney(sheet.total)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Status:</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span
                className="size-2 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              {jobStatusLabel(job.status)}
            </span>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-md border border-border-soft bg-[#f7f8fa] px-4 py-2 text-sm">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground">Customer:</span>
            {estimate?.customerId ? (
              <Link
                href={`/pro/dashboard/customers/${estimate.customerId}`}
                className="truncate font-semibold text-primary hover:underline"
              >
                {customerLabel?.trim() ||
                  estimate.customerName?.trim() ||
                  "View customer"}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">
                {customerLabel?.trim() ||
                  estimate?.customerName?.trim() ||
                  "—"}
              </span>
            )}
          </span>
          {siteAddress ? (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
              <span className="text-muted-foreground">Site:</span>
              <span className="truncate font-medium text-foreground">
                {siteAddress}
              </span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">Quote total:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoney(
                typeof quoteTotal === "number" ? quoteTotal : sheet.total,
              )}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Status:</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span
                className="size-2 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              {estimate
                ? estimateStatusLabel(estimate.status)
                : "—"}
            </span>
          </span>
        </div>
      )}
      {isEstimate && estimate ? (
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-soft pb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Estimate summary
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {estimate.title?.trim() || "Untitled estimate"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {estimateStatusLabel(estimate.status)}
              {locked ? " · Locked" : " · Title, address, and dates"}
            </p>
          </div>
          <div className="rounded-md bg-secondary px-3 py-2 text-right">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Quote total
            </p>
            <p className="text-lg font-semibold tabular-nums text-primary">
              {formatMoney(sheet.total)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-soft pb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Job summary
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {job.title?.trim() || job.number}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {jobStatusLabel(job.status)}
              {technician ? ` · ${technician}` : " · Unassigned"}
            </p>
            {estimate ? (
              <p className="mt-2 text-sm text-muted-foreground">
                From estimate{" "}
                <Link
                  href={`/pro/dashboard/estimates/${estimate.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {estimate.number}
                </Link>
                {estimate.title ? ` · ${estimate.title}` : ""}
              </p>
            ) : null}
            {estimate?.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {estimate.notes}
              </p>
            ) : null}
          </div>
          <div className="rounded-md bg-secondary px-3 py-2 text-right">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Job total
            </p>
            <p className="text-lg font-semibold tabular-nums text-primary">
              {formatMoney(sheet.total)}
            </p>
          </div>
        </div>
      )}
      {notice ? <div className="space-y-3">{notice}</div> : null}
      {isEstimate && estimate?.scheduledDate ? (
        <div className="rounded-md bg-sky-50 px-4 py-2.5 text-sm">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-sky-800 uppercase">
            Scheduled date
          </p>
          <p className="mt-0.5 font-semibold text-sky-950">
            {formatDate(estimate.scheduledDate)}
          </p>
        </div>
      ) : null}
      {isEstimate && quoteAnswers.length > 0 ? (
        <section className="rounded-md border border-input bg-card">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="answers" className="border-0">
              <AccordionTrigger className="rounded-md border-0 bg-[#f5f5f5] px-4 py-2.5 shadow-none hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:border-b data-[state=open]:border-input">
                <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      Estimate Request & Answers
                    </h3>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      Click to view estimate request details and answers
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {quoteAnswers.length} question
                    {quoteAnswers.length === 1 ? "" : "s"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="p-3">
                  <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {quoteAnswers.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border border-border-soft bg-[#fafbfc] px-3 py-2.5"
                      >
                        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {item.label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium wrap-break-word text-foreground">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section className="h-auto self-start rounded-md border border-input bg-card">
          <div className="flex items-center justify-between gap-3 rounded-t-md border-b border-input bg-[#f5f5f5] px-4 py-2.5">
            <h3 className="text-sm font-semibold">
              {isEstimate ? "Quote mix" : "Cost mix"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Labour {formatMoney(mix.labor)} · Material {formatMoney(mix.materials)}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 rounded-b-md px-4 py-5">
            <JobCostChart
              labor={mix.labor}
              materials={mix.materials}
              className="mx-0 size-44"
            />
            <JobCostLegend labor={mix.labor} materials={mix.materials} />
          </div>
        </section>

        <section className="h-auto self-start rounded-md border border-input bg-card">
          <div className="rounded-t-md border-b border-input bg-[#f5f5f5] px-4 py-3">
            <h3 className="text-sm font-semibold">Line items</h3>
          </div>
          <div className="space-y-4 rounded-b-md p-4 text-sm">
            <LineGroup title="Labour" lines={laborLines} />
            <LineGroup title="Material" lines={materialLines} />
            <dl className="space-y-2 border-t border-border-soft pt-3">
              <MoneyRow label="Subtotal" value={sheet.subtotal} />
              <MoneyRow
                label={`Tax (${formatTaxRatePercent(taxRatePercent)}%)`}
                value={sheet.tax}
              />
              <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
                <dt className="font-semibold">Total</dt>
                <dd className="text-base font-semibold tabular-nums text-primary">
                  {formatMoney(sheet.total)}
                </dd>
              </div>
            </dl>
            {!isEstimate ? (
              <p className="text-xs text-muted-foreground">
                {invoice
                  ? `${invoice.number} is on file. Materials lock after the invoice leaves draft.`
                  : hasInvoice
                    ? "Materials lock after the invoice leaves draft."
                    : "No invoice yet. Costs can still move."}
              </p>
            ) : null}
          </div>
        </section>

        <section className="h-auto self-start bg-transparent">
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-t-md border border-input bg-[#f5f5f5] px-4 py-2.5">
            <h3 className="text-sm font-semibold">Activity</h3>
            {locked ? null : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="size-3.5 text-primary" />
                Create note
              </Button>
            )}
          </div>
          <div className="pt-3">
            {activities.length ? (
              <ul className="relative space-y-0">
                {activities.map((item, index) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    last={index === activities.length - 1}
                    locked={locked}
                    deleting={
                      (isEstimate && estimateActivities.deletingId === item.id) ||
                      (isJobRecord && jobActivities.deletingId === item.id)
                    }
                    onEdit={() => {
                      setEditing({ id: item.id, title: item.title, html: item.html });
                      setOpen(true);
                    }}
                    onDelete={async () => {
                      if (isEstimate) {
                        await estimateActivities.deleteActivity(item.id);
                      } else if (isJobRecord) {
                        await jobActivities.deleteActivity(item.id);
                      } else {
                        file.removeActivity(item.id);
                        toast.success("Activity deleted.");
                      }
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing posted yet. Add a field note, call, or follow-up.
              </p>
            )}
          </div>
        </section>
      </div>


      <ActivityDialog
        open={open}
        activity={editing}
        saving={
          saving ||
          (isEstimate && estimateActivities.saving) ||
          (isJobRecord && jobActivities.saving)
        }
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
        onSave={async (title, html) => {
          if (isEstimate) {
            setSaving(true);
            try {
              if (editing) {
                await estimateActivities.updateActivity(editing.id, title, html);
              } else {
                await estimateActivities.addActivity(title, html);
              }
              setOpen(false);
              setEditing(null);
            } finally {
              setSaving(false);
            }
          } else if (isJobRecord) {
            setSaving(true);
            try {
              if (editing) {
                await jobActivities.updateActivity(editing.id, title, html);
              } else {
                await jobActivities.addActivity(title, html);
              }
              setOpen(false);
              setEditing(null);
            } finally {
              setSaving(false);
            }
          } else {
            if (editing) {
              file.updateActivity(editing.id, title, html);
              toast.success("Activity updated.");
            } else {
              file.addActivity(title, html);
              toast.success("Activity posted.");
            }
            setOpen(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

export function JobMaterialsTab({
  job,
  estimate,
  invoice,
  technician,
  noun = "job",
  locked: propLocked,
  onSave,
  preferApi = false,
  ready = true,
  hideHeader = false,
  onActionsChange,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  locked?: boolean;
  onSave?: (lines: JobCostLine[]) => void | Promise<void>;
  preferApi?: boolean;
  ready?: boolean;
  hideHeader?: boolean;
  onActionsChange?: (actions: JobCostingActions | null) => void;
}) {
  const { addLog, locked: fileLocked } = useJobFile(job, estimate, invoice, technician);
  const isLocked = propLocked ?? fileLocked;
  return (
    <JobCosting
      job={job}
      locked={isLocked}
      noun={noun}
      onMutate={preferApi ? undefined : addLog}
      onSave={onSave}
      preferApi={preferApi}
      ready={ready}
      hideHeader={hideHeader}
      onActionsChange={onActionsChange}
    />
  );
}

export function JobSettingsTab({
  job,
  estimate,
  invoice,
  technician,
  service,
  customerLabel,
  start,
  due,
  employeeId,
  hideHeader = false,
  onActionsChange,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  service: string;
  customerLabel?: string;
  start?: string;
  due?: string;
  employeeId?: string;
  hideHeader?: boolean;
  onActionsChange?: (
    actions: { saving: boolean; save: () => void } | null,
  ) => void;
}) {
  const dispatch = useAppDispatch();
  const { customers, contractors } = useCrmDirectory();
  const crm = useCrmApiData();
  const useApi = crm.enabled;
  const customerPaging = usePaginatedCrmOptions(useApi ? "customer" : null, useApi);
  // Fetch full team (no role filter) — DB roles may not match UI "technician"; we filter client-side.
  const assigneePaging = usePaginatedCrmOptions(
    useApi ? "assignee" : null,
    useApi,
  );
  const teamItems = useAppSelector((state) => state.team?.items ?? []);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const { employees, events } = usePortalCrew();
  const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
  /** Persist team-member options across Unassigned / selection changes. */
  const teamMemberOptionsCacheRef = useRef<Map<string, { id: string; label: string }>>(
    new Map(),
  );

  useEffect(() => {
    if (!useApi) return;
    void dispatch(fetchTeam({ force: true, limit: 100, page: 1, role: "" }));
  }, [dispatch, useApi]);

  function resolveEmployeeId(): string {
    const candidates = [
      employeeId,
      job.assignedEmployeeId,
      event?.employeeId,
    ].filter(Boolean) as string[];
    for (const id of candidates) {
      if (employees.some((item) => item.id === id)) return id;
      if (contractors.some((item) => item.id === id)) return id;
    }
    // Keep known API id even if crew list has not loaded yet.
    if (job.assignedEmployeeId) return job.assignedEmployeeId;
    if (employeeId) return employeeId;

    const name = (technician || job.assignedTo || "").trim().toLowerCase();
    if (!name) return "";
    const byEmployeeName = employees.find(
      (item) => employeeName(item).trim().toLowerCase() === name,
    );
    if (byEmployeeName) return byEmployeeName.id;
    const byPartial = employees.find((item) => {
      const label = employeeName(item).trim().toLowerCase();
      return label.includes(name) || name.includes(label);
    });
    if (byPartial) return byPartial.id;
    const byContractor = contractors.find(
      (item) => item.companyName.trim().toLowerCase() === name,
    );
    if (byContractor) return byContractor.id;
    return "";
  }

  function defaultsFromJob(): JobSettingsDraft {
    const resolvedId = resolveEmployeeId();
    return {
      name: job.title || service || "",
      customerId: job.customerId || "",
      street: job.address?.address || job.address?.street || "",
      city: job.address?.city || "",
      state: job.address?.state || "",
      zip: job.address?.zip || "",
      latitude: job.address?.latitude ?? job.address?.lat ?? null,
      longitude: job.address?.longitude ?? job.address?.lng ?? null,
      start: (start || job.scheduledAt || "").slice(0, 10),
      due: (due || job.dueAt || "").slice(0, 10),
      employeeId: resolvedId,
      assignedTo: technician || job.assignedTo || "",
      status: job.status,
      notes: job.notes ?? "",
    };
  }

  const [draft, setDraft] = useState<JobSettingsDraft>(defaultsFromJob);
  const [saving, setSaving] = useState(false);

  // Sync draft when the API job changes — avoid useEffect + unstable crew refs (infinite loop).
  const syncKey = [
    job.id,
    job.updatedAt,
    job.title ?? "",
    job.customerId ?? "",
    job.status,
    job.scheduledAt ?? "",
    job.dueAt ?? "",
    job.notes ?? "",
    job.address?.street ?? "",
    job.address?.city ?? "",
    job.address?.state ?? "",
    job.address?.zip ?? "",
    job.assignedTo ?? "",
    job.assignedEmployeeId ?? "",
    service,
    start ?? "",
    due ?? "",
    employeeId ?? "",
    technician,
  ].join("|");
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    setDraft(defaultsFromJob());
  }

  const selected = customers.find((item) => item.id === draft.customerId);
  const customerDisplayName =
    (selected ? crmCustomerName(selected) : "") ||
    customerLabel?.trim() ||
    (draft.customerId ? `Customer ${draft.customerId.slice(-6)}` : "");

  const technicianOptions = useMemo(() => {
    const merged = [...employees, ...teamItems];
    const seen = new Set<string>();
    const base: typeof employees = [];
    for (const item of merged) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      if (item.active === false) continue;
      // Only field "Team member" crew (role technician after CRM map).
      if (item.role !== "technician") continue;
      base.push(item);
    }
    if (draft.employeeId && !base.some((item) => item.id === draft.employeeId)) {
      const missing = merged.find((item) => item.id === draft.employeeId);
      if (missing) return [missing, ...base];
      return [
        {
          id: draft.employeeId,
          firstName: draft.assignedTo || "Assigned",
          lastName: "",
          role: "technician",
          trade: "",
          email: "",
          phone: "",
          active: true,
        } as (typeof employees)[number],
        ...base,
      ];
    }
    return base;
  }, [employees, teamItems, draft.employeeId, draft.assignedTo]);

  const contractorOptions = useMemo(() => {
    // Job assignee is team members only — keep lookup for legacy assigned contractors.
    if (
      draft.employeeId &&
      !technicianOptions.some((item) => item.id === draft.employeeId)
    ) {
      const missing = contractors.find((item) => item.id === draft.employeeId);
      if (missing) return [missing];
    }
    return [];
  }, [contractors, draft.employeeId, technicianOptions]);

  const customerSelectOptions = useMemo(
    () =>
      useApi
        ? customerPaging.options
        : customers.map((item) => ({
            id: item.id,
            label: crmCustomerName(item),
          })),
    [useApi, customerPaging.options, customers],
  );

  const assigneeSelectOptions = useMemo(() => {
    const cache = teamMemberOptionsCacheRef.current;
    const techIds = new Set(
      [...employees, ...teamItems]
        .filter((item) => item?.id && item.active !== false && item.role === "technician")
        .map((item) => item.id),
    );

    // Drop non–team-member rows once we know roles (keeps Unassign from wiping list).
    if (techIds.size > 0) {
      for (const id of Array.from(cache.keys())) {
        if (!techIds.has(id) && id !== draft.employeeId) cache.delete(id);
      }
    }

    for (const item of technicianOptions) {
      if (!item.id) continue;
      cache.set(item.id, { id: item.id, label: employeeName(item) });
    }

    if (useApi) {
      for (const item of assigneePaging.options) {
        if (!item.id) continue;
        if (techIds.size > 0 && !techIds.has(item.id) && item.id !== draft.employeeId) {
          continue;
        }
        if (techIds.size === 0) continue; // wait for crew roles before caching API rows
        const label = item.label.includes(" · ")
          ? item.label.split(" · ")[0]!.trim()
          : item.label;
        cache.set(item.id, { id: item.id, label });
      }
    }

    if (
      draft.employeeId &&
      !cache.has(draft.employeeId) &&
      draft.assignedTo.trim()
    ) {
      cache.set(draft.employeeId, {
        id: draft.employeeId,
        label: draft.assignedTo.trim(),
      });
    }

    return [{ id: "", label: "Unassigned" }, ...Array.from(cache.values())];
  }, [
    useApi,
    assigneePaging.options,
    technicianOptions,
    employees,
    teamItems,
    draft.employeeId,
    draft.assignedTo,
  ]);

  const addressLine = [draft.street, formatLocation(draft.city, draft.state, draft.zip)]
    .filter(Boolean)
    .join(", ");
  const invoiceHref = invoice?.id
    ? `/pro/dashboard/invoices/${invoice.id}`
    : job.invoiceId
      ? `/pro/dashboard/invoices/${resolveCrmObjectId(job.invoiceId) || job.invoiceId}`
      : null;
  const hasInvoice = Boolean(invoiceHref) || job.status === "invoiced" || job.status === "paid";
  const assigneeLabel = (() => {
    const fromOptions = assigneeSelectOptions.find(
      (item) => item.id && item.id === draft.employeeId,
    );
    if (fromOptions) return fromOptions.label;
    const tech = technicianOptions.find((item) => item.id === draft.employeeId);
    if (tech) return employeeName(tech);
    const contractor = contractorOptions.find((item) => item.id === draft.employeeId);
    if (contractor) return contractor.companyName;
    return draft.assignedTo || "Unassigned";
  })();

  function patch(next: Partial<JobSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function save() {
    if (saving) return;
    const tech = employees.find((item) => item.id === draft.employeeId);
    const contractor = contractors.find((item) => item.id === draft.employeeId);
    const nextCustomerId = draft.customerId || job.customerId;
    if (!nextCustomerId) {
      toast.error("Select a customer before saving.");
      return;
    }
    if (!draft.start) {
      toast.error("Set a start date before saving.");
      return;
    }
    // Empty employeeId = Unassigned is allowed; provider can assign later.
    const next = {
      ...draft,
      customerId: nextCustomerId,
      assignedTo: tech
        ? employeeName(tech)
        : contractor
          ? contractor.companyName
          : draft.assignedTo,
    };
    setSaving(true);
    try {
      const updated = await dispatch(
        updateJobRecord({
          id: job.id,
          employees,
          job: {
            ...job,
            title: next.name.trim() || job.title,
            customerId: next.customerId,
            notes: next.notes,
            scheduledAt: next.start || undefined,
            dueAt: next.due || undefined,
            assignedTo: next.employeeId || "",
            assignedEmployeeId: next.employeeId || "",
            address: {
              ...job.address,
              address: next.street || job.address.address || job.address.street,
              street: next.street || job.address.street,
              city: next.city || job.address.city,
              state: next.state || job.address.state,
              zip: next.zip || job.address.zip,
              latitude:
                next.latitude !== undefined
                  ? next.latitude
                  : job.address.latitude,
              longitude:
                next.longitude !== undefined
                  ? next.longitude
                  : job.address.longitude,
              lat:
                next.latitude !== undefined
                  ? next.latitude
                  : job.address.lat,
              lng:
                next.longitude !== undefined
                  ? next.longitude
                  : job.address.lng,
            },
          },
        }),
      ).unwrap();
      // Status is edited from the job board / actions — not from settings.

      // Always hit schedule API so collisions return the exact server message.
      const slot = minutesForWindow(event?.timeWindow ?? "morning");
      const startMinutes = event?.startMinutes ?? slot.startMinutes;
      const endMinutes = event?.endMinutes ?? slot.endMinutes;
      const schedulePayload = {
        title: job.number,
        date: next.start,
        endDate: next.due || next.start,
        startMinutes,
        endMinutes,
        timeWindow: event?.timeWindow ?? ("morning" as const),
        employeeId: contractor ? null : next.employeeId,
        contractorId: contractor ? next.employeeId : null,
        status: "scheduled" as const,
      };
      try {
        if (event?.id && !event.id.startsWith("cal_")) {
          await updateSchedule(event.id, schedulePayload);
        } else {
          await assignSchedule({
            recordId: job.id,
            kind: "job",
            ...schedulePayload,
          });
        }
      } catch (calendarError) {
        void dispatch(fetchJobDetail(job.id));
        toast.error(extractErrorMessage(calendarError));
        return;
      }

      void dispatch(fetchJobDetail(job.id));
      if (crm.ready) void crm.refresh({ silent: true });
      toast.success("Job settings saved.");
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef(() => {
    void save();
  });
  saveRef.current = () => {
    void save();
  };
  const saveStable = useCallback(() => {
    saveRef.current();
  }, []);

  useEffect(() => {
    if (!onActionsChange) return;
    onActionsChange({ saving, save: saveStable });
  }, [onActionsChange, saving, saveStable]);

  useEffect(() => {
    if (!onActionsChange) return;
    return () => onActionsChange(null);
  }, [onActionsChange]);

  return (
    <>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
      <div data-job-settings-form className="space-y-4 rounded-md bg-secondary/40 p-4 sm:p-5">
        {hideHeader ? null : (
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Job settings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Name, customer, schedule, and site address for this job.
              </p>
            </div>
            <Button size="sm" className="h-8" disabled={saving} onClick={() => void save()}>
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job name">
            <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </Field>
          <Field label="Customer">
            <PaginatedEntitySelect
              id="job-settings-customer"
              value={draft.customerId}
              options={customerSelectOptions}
              selectedLabel={customerDisplayName || undefined}
              placeholder="Select customer"
              emptyLabel="No customers found."
              loading={useApi ? customerPaging.loading : false}
              loadingMore={useApi ? customerPaging.loadingMore : false}
              hasMore={useApi ? customerPaging.hasMore : false}
              onLoadMore={useApi ? customerPaging.loadMore : () => {}}
              searchable={useApi}
              searchValue={useApi ? customerPaging.search : ""}
              onSearchChange={useApi ? customerPaging.setSearch : undefined}
              searchPlaceholder="Search customers…"
              addLabel="Add customer"
              onAdd={() => setCreateCustomerOpen(true)}
              onChange={(id) => patch({ customerId: id })}
            />
          </Field>
          <Field label="Assigned team member">
            <PaginatedEntitySelect
              id="job-settings-assignee"
              value={draft.employeeId}
              options={assigneeSelectOptions}
              selectedLabel={
                draft.employeeId && assigneeLabel !== "Unassigned"
                  ? assigneeLabel
                  : draft.assignedTo || undefined
              }
              placeholder="Unassigned"
              emptyLabel="No team members found."
              loading={useApi ? assigneePaging.loading : false}
              loadingMore={useApi ? assigneePaging.loadingMore : false}
              hasMore={useApi ? assigneePaging.hasMore : false}
              onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
              searchable={useApi}
              searchValue={useApi ? assigneePaging.search : ""}
              onSearchChange={useApi ? assigneePaging.setSearch : undefined}
              searchPlaceholder="Search team members…"
              addLabel="Add team member"
              onAdd={() => {
                window.location.assign("/pro/dashboard/team");
              }}
              onChange={(id, option) =>
                patch({
                  employeeId: id,
                  assignedTo: id && option?.label ? option.label : "",
                })
              }
            />
          </Field>
          <Field label="Start date">
            <Input type="date" value={draft.start} onChange={(event) => patch({ start: event.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={draft.due} onChange={(event) => patch({ due: event.target.value })} />
          </Field>
          {selected?.phone ? (
            <Field label="Customer phone">
              <Input readOnly className="bg-muted/50" value={selected.phone} />
            </Field>
          ) : null}
          {selected?.email ? (
            <Field label="Customer email">
              <Input readOnly className="bg-muted/50" value={selected.email} />
            </Field>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Address">
              <GoogleAddressAutocomplete
                id="job-settings-address"
                value={draft.street}
                onChange={(value) => patch({ street: value })}
                onSelect={(address: PlaceAddress) =>
                  patch({
                    street: address.streetAddress.trim(),
                    city: address.city || "",
                    state: normalizeUsStateCode(address.state) || "",
                    zip: address.zipCode || "",
                    latitude: address.latitude ?? null,
                    longitude: address.longitude ?? null,
                  })
                }
                placeholder="Start typing your address…"
              />
            </Field>
          </div>
          <Field label="City">
            <Input value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
          </Field>
          <Field label="State">
            <UsStateSelect
              value={normalizeUsStateCode(draft.state)}
              onChange={(code) => patch({ state: code })}
              placeholder="State"
            />
          </Field>
          <Field label="ZIP">
            <Input value={draft.zip} onChange={(event) => patch({ zip: event.target.value })} />
          </Field>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Notes</span>
            <Textarea
              rows={4}
              value={draft.notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                patch({ notes: event.target.value })
              }
            />
          </label>
          {estimate ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Converted from{" "}
              <Link
                href={`/pro/dashboard/new-estimate/${estimate.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {estimate.number}
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 content-start">
        <section className="rounded-md bg-secondary/40 px-4 py-4">
          <h3 className="text-sm font-semibold">Job snapshot</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold tracking-tight">{job.number}</p>
              <StatusPill label={jobStatusLabel(draft.status)} className={jobStatusTone(draft.status)} />
            </div>
            <p className="text-muted-foreground">{draft.name || service || "Untitled job"}</p>
            <dl className="space-y-2.5 border-t border-border-soft pt-3">
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Customer
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {draft.customerId ? (
                      selected ? (
                        <Link
                          href={`/pro/dashboard/customers/${selected.id}`}
                          className="text-primary hover:underline"
                        >
                          {crmCustomerName(selected)}
                        </Link>
                      ) : (
                        customerDisplayName || "Linked customer"
                      )
                    ) : (
                      "Not set"
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Team member
                  </dt>
                  <dd className="mt-0.5 font-medium">{assigneeLabel}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Schedule
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {draft.start ? formatDate(draft.start) : "Not scheduled"}
                    {draft.due ? ` → ${formatDate(draft.due)}` : ""}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Address
                  </dt>
                  <dd className="mt-0.5 font-medium">{addressLine || "No address yet"}</dd>
                </div>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-md bg-secondary/40 px-4 py-4">
          <h3 className="text-sm font-semibold">Billing</h3>
          <div className="mt-3 space-y-3 text-sm">
            {hasInvoice ? (
              <>
                <p className="font-medium">
                  {invoice?.number ? `${invoice.number} is on file` : "This job has been invoiced"}
                </p>
                {invoiceHref ? (
                  <Button size="sm" variant="outline" className="h-8 border-border-soft" asChild>
                    <Link href={invoiceHref}>Open invoice</Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                No invoice yet. Convert from the job header when materials are ready.
              </p>
            )}
            {estimate ? (
              <p className="border-t border-border-soft pt-3 text-xs text-muted-foreground">
                Source estimate{" "}
                <Link
                  href={`/pro/dashboard/new-estimate/${estimate.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {estimate.number}
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
    <CreateCustomerDialog
      open={createCustomerOpen}
      onOpenChange={setCreateCustomerOpen}
      onSaved={(created) => {
        const label = crmCustomerName(created);
        patch({ customerId: created.id });
        customerPaging.prependOption({ id: created.id, label });
      }}
    />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function JobLogsTab({
  job,
  estimate,
  invoice,
  technician,
  noun = "job",
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
}) {
  const { logs } = useJobFile(job, estimate, invoice, technician);
  const apiLogs = (estimate?.logs ?? []).map((log) => ({
    id: log.id,
    title: log.action || "Estimate updated",
    detail: log.details || "",
    actor: log.actor || "System",
    at: log.timestamp,
  }));
  const displayLogs = noun === "estimate" && apiLogs.length > 0 ? apiLogs : logs;

  return (
    <div className="space-y-0">
      <div className="mb-3 px-1">
        <p className="text-sm font-bold text-foreground">
          {noun === "estimate"
            ? "Estimate log"
            : noun === "invoice"
              ? "Invoice log"
              : "Job log"}
        </p>
        <p className="text-xs text-muted-foreground">
          {noun === "estimate"
            ? "Every change on this quote is recorded here."
            : noun === "invoice"
              ? "Every change on this invoice is recorded here."
              : "Every change on this job is recorded here."}
        </p>
      </div>
      <ol className="space-y-0">
        {displayLogs.map((item, index) => (
          <LogRow key={item.id} item={item} last={index === displayLogs.length - 1} />
        ))}
      </ol>
    </div>
  );
}

export function JobAttachmentsTab({
  job,
  estimate,
  invoice,
  technician,
  noun = "job",
  locked = false,
  onSave,
  hideHeader = false,
  onActionsChange,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  locked?: boolean;
  onSave?: (updated: Estimate) => void;
  hideHeader?: boolean;
  onActionsChange?: (
    actions: {
      locked: boolean;
      saving: boolean;
      uploading: boolean;
      dirty: boolean;
      save: () => void;
    } | null,
  ) => void;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const file = useJobFile(job, estimate, invoice, technician);
  const {
    addAttachments,
    replaceAttachments,
    removeAttachment,
    actor,
    attachments: localAttachments,
  } = file;
  const crm = useCrmApiData();
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  // API is source of truth for estimate / job / invoice — never local-only when signed in.
  const preferApiAttachments =
    useApi && (noun === "estimate" || noun === "job" || noun === "invoice");
  const jobDetail = useAppSelector((state) =>
    job?.id ? state.jobs?.detailsCache?.[job.id] ?? null : null,
  );
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<JobAttachment[] | null>(null);
  const [liveEstimate, setLiveEstimate] = useState<Estimate | null>(null);
  const [fetching, setFetching] = useState(false);

  // Vendor pattern: GET the record again when Attachments opens.
  useEffect(() => {
    if (!preferApiAttachments) return;
    let cancelled = false;

    async function refreshFromApi() {
      const estimateId = estimate?.id;
      const jobId = job?.id;

      if (noun === "estimate" && estimateId) {
        const hasRows = (estimate?.attachments?.length ?? 0) > 0;
        if (!hasRows) setFetching(true);
        try {
          const updated = await getEstimate(estimateId);
          if (cancelled || !updated) return;
          setLiveEstimate(updated);
          onSave?.(updated);
        } catch (error) {
          if (!cancelled) {
            toast.error(
              error instanceof Error ? error.message : "Could not load attachments.",
            );
          }
        } finally {
          if (!cancelled) setFetching(false);
        }
        return;
      }

      if (noun === "job" && jobId) {
        const hasRows =
          (jobDetail?.attachments?.length ?? job?.attachments?.length ?? 0) > 0;
        if (!hasRows) setFetching(true);
        try {
          await dispatch(fetchJobDetail(jobId)).unwrap();
        } catch (error) {
          if (!cancelled) {
            toast.error(
              typeof error === "string"
                ? error
                : error instanceof Error
                  ? error.message
                  : "Could not load attachments.",
            );
          }
        } finally {
          if (!cancelled) setFetching(false);
        }
      }
    }

    void refreshFromApi();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when tab opens / record id changes
  }, [preferApiAttachments, noun, estimate?.id, job?.id, invoice?.id, dispatch]);

  const activeEstimate =
    liveEstimate?.id && estimate?.id && liveEstimate.id === estimate.id
      ? liveEstimate
      : estimate;
  const activeJob =
    jobDetail?.id === job.id
      ? { ...job, ...jobDetail, attachments: jobDetail.attachments ?? job.attachments }
      : job;

  const savedAttachments = useMemo<JobAttachment[]>(() => {
    const prefix =
      noun === "estimate"
        ? activeEstimate?.id ?? "att"
        : noun === "invoice"
          ? invoice?.id ?? "att"
          : activeJob?.id ?? "att";
    const addedAt =
      (noun === "estimate"
        ? activeEstimate?.createdAt
        : noun === "invoice"
          ? invoice?.createdAt
          : activeJob?.createdAt) ?? new Date().toISOString();

    const rawList =
      noun === "estimate"
        ? activeEstimate?.attachments
        : noun === "invoice"
          ? invoice?.attachments
          : activeJob?.attachments;

    const fromRecord = (() => {
      if (!rawList || !Array.isArray(rawList)) return [] as JobAttachment[];
      return rawList
        .map((item, index) => toJobAttachmentItem(item, index, prefix, addedAt))
        .filter((item) => Boolean(item.dataUrl));
    })();

    // Local merge only when CRM is offline / unavailable.
    if (!preferApiAttachments && localAttachments.length > 0) {
      const byUrl = new Map<string, JobAttachment>();
      for (const item of [...localAttachments, ...fromRecord]) {
        const key = (item.dataUrl || item.id || "").trim();
        if (!key || byUrl.has(key)) continue;
        byUrl.set(key, item);
      }
      return Array.from(byUrl.values());
    }
    return fromRecord;
  }, [
    noun,
    activeEstimate,
    invoice,
    activeJob,
    localAttachments,
    preferApiAttachments,
  ]);

  useEffect(() => {
    setDraft(null);
    setLiveEstimate(null);
  }, [estimate?.id, invoice?.id, job?.id]);

  const activeAttachments = draft ?? savedAttachments;
  const listLoading =
    preferApiAttachments &&
    fetching &&
    !draft &&
    savedAttachments.length === 0;

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (draft.length !== savedAttachments.length) return true;
    return draft.some((item, index) => {
      const saved = savedAttachments[index];
      if (!saved) return true;
      return (
        (item.dataUrl || "").trim() !== (saved.dataUrl || "").trim() ||
        (item.name || "").trim() !== (saved.name || "").trim()
      );
    });
  }, [draft, savedAttachments]);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleClickCapture = (event: MouseEvent) => {
      if (bypassingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest("[data-job-attachments-tab]") ||
        target.closest("[role='dialog']") ||
        target.closest("[role='listbox']") ||
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-focus-guard]") ||
        target.closest("[data-radix-portal]") ||
        target.closest("[data-sonner-toaster]") ||
        target.closest(".sonner-toast")
      ) {
        return;
      }

      const interactiveEl = target.closest(
        "button, a[href], [role='tab'], [role='button'], [data-tab-id]"
      ) as HTMLElement | null;

      if (!interactiveEl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      pendingActionRef.current = () => {
        interactiveEl.click();
      };

      setShowUnsavedDialog(true);
    };

    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty]);

  function executePending() {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
    if (action) {
      bypassingRef.current = true;
      setTimeout(() => {
        action();
        setTimeout(() => {
          bypassingRef.current = false;
        }, 150);
      }, 0);
    }
  }

  function attachmentPayload(nextAttachments: JobAttachment[]) {
    return nextAttachments
      .map((item) => ({
        name: (item.name || "").trim() || "Attachment",
        attachment: (item.dataUrl || "").trim(),
      }))
      .filter((item) => Boolean(item.attachment));
  }

  async function persistAttachments(nextAttachments: JobAttachment[]) {
    // Local store only when API is not the source of truth.
    if (!preferApiAttachments) {
      replaceAttachments(nextAttachments);
    }

    if (noun === "estimate" && (activeEstimate?.id || estimate?.id)) {
      const estimateId = activeEstimate?.id || estimate!.id;
      const payload = attachmentPayload(nextAttachments);
      const base = activeEstimate ?? estimate!;
      const updatedEstimate: Estimate = {
        ...base,
        attachments: payload,
      };
      crm.patchEstimate(estimateId, updatedEstimate);
      onSave?.(updatedEstimate);
      const updated = await updateEstimateAttachments(estimateId, payload);
      if (updated) {
        setLiveEstimate(updated);
        crm.patchEstimate(estimateId, updated);
        onSave?.(updated);
        return updated;
      }
      setLiveEstimate(updatedEstimate);
      return updatedEstimate;
    }

    if (noun === "invoice" && invoice?.id) {
      const payload = attachmentPayload(nextAttachments);
      const updated = await updateInvoiceAttachments(invoice.id, payload);
      if (updated) {
        dispatch(upsertInvoiceItem(updated));
        return updated;
      }
      return null;
    }

    // Job attachments (even when a linked estimate exists for context).
    if (noun === "job" && job?.id) {
      const urls = nextAttachments
        .map((item) => (item.dataUrl || "").trim())
        .filter(Boolean);
      const updated = await updateJobAttachments(job.id, urls);
      if (updated) {
        dispatch(upsertJobItem(updated));
        void dispatch(fetchJobDetail(job.id));
        return updated;
      }
    }

    return null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await persistAttachments(activeAttachments);
      setDraft(null);
      toast.success("Attachments saved.");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not save attachments.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndLeave() {
    try {
      setSaving(true);
      await persistAttachments(activeAttachments);
      setDraft(null);
      toast.success("Attachments saved.");
      executePending();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not save attachments.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardAndLeave() {
    setDraft(null);
    executePending();
  }

  function handleCancelDialog() {
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
  }

  function handleDelete(fileItem: JobAttachment) {
    const current = draft ?? savedAttachments;
    const remaining = current.filter(
      (item) => item.id !== fileItem.id && item.dataUrl !== fileItem.dataUrl,
    );
    setDraft(remaining);
    if (!preferApiAttachments) {
      removeAttachment(fileItem.id);
      toast.success(`${fileItem.name} removed.`);
      return;
    }
    // Persist immediately to API (vendor-style).
    void (async () => {
      setSaving(true);
      try {
        await persistAttachments(remaining);
        setDraft(null);
        toast.success(`${fileItem.name} removed.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not remove attachment.",
        );
      } finally {
        setSaving(false);
      }
    })();
  }

  async function readFiles(list: FileList | File[]) {
    if (uploading) return;
    const files = Array.from(list);
    if (!files.length) return;

    for (const nextFile of files) {
      const check = validateAttachmentFile(nextFile);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
    }

    setUploading(true);
    try {
      const addedList: JobAttachment[] = [];
      for (const nextFile of files) {
        const response = await uploadAnyFile(nextFile);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${nextFile.name}.`);
        const item: JobAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${nextFile.name}`,
          name: nextFile.name,
          type: nextFile.type || "application/octet-stream",
          size: nextFile.size,
          dataUrl: url,
          addedAt: new Date().toISOString(),
          actor,
        };
        addedList.push(item);
      }
      const nextList = [...addedList, ...(draft ?? savedAttachments)];
      setDraft(nextList);
      if (!preferApiAttachments) {
        addAttachments(addedList);
        for (const item of addedList) toast.success(`${item.name} attached.`);
        return;
      }
      // Persist immediately to API (vendor-style).
      await persistAttachments(nextList);
      setDraft(null);
      for (const item of addedList) toast.success(`${item.name} attached.`);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "").trim()
            : "";
      toast.error(message || "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) void readFiles(event.dataTransfer.files);
  }

  const emptyLabel =
    locked
      ? `No attachments on this ${noun}.`
      : `No files on this ${noun} yet.`;

  const saveRef = useRef(() => {
    void handleSave();
  });
  saveRef.current = () => {
    void handleSave();
  };

  const saveStable = useCallback(() => {
    saveRef.current();
  }, []);

  useEffect(() => {
    if (!onActionsChange) return;
    onActionsChange({
      locked,
      saving,
      uploading,
      dirty: isDirty,
      save: saveStable,
    });
  }, [onActionsChange, locked, saving, uploading, isDirty, saveStable]);

  useEffect(() => {
    if (!onActionsChange) return;
    return () => onActionsChange(null);
  }, [onActionsChange]);

  return (
    <div data-job-attachments-tab>
      {hideHeader ? null : (
        <div className="-mx-4 -mt-1.5 mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-secondary px-4 py-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">Attachments</h2>
            <p className="text-xs text-muted-foreground">
              Photos, PDFs, videos, and other{" "}
              {noun === "estimate" ? "quote" : noun === "invoice" ? "invoice" : "job"}{" "}
              files. Preview or remove anytime.
            </p>
          </div>
          {!locked ? (
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => void handleSave()}
              disabled={saving || uploading || !isDirty}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save attachments"
              )}
            </Button>
          ) : null}
        </div>
      )}
      {listLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading attachments…
        </div>
      ) : (
        <>
      {!locked ? (
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors",
            over ? "border-primary bg-secondary" : "border-border-soft bg-secondary/40",
            uploading && "pointer-events-none opacity-60",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-primary" />
          ) : (
            <Upload className="size-6 text-primary" />
          )}
          <p className="text-sm font-medium">
            {uploading ? "Uploading files…" : "Drop files here or browse"}
          </p>
          <p className="text-xs text-muted-foreground">Images, PDF, Video, and Audio up to 500 MB</p>
          <input
            className="sr-only"
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
            disabled={uploading}
            onChange={(event) => {
              if (event.target.files?.length) void readFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
      {activeAttachments.length ? (
        <ul className="mt-4 divide-y divide-input border border-border-soft">
          {activeAttachments.map((fileItem) => (
            <li key={fileItem.id} className="flex items-center gap-3 px-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-[#eef1f5] text-primary">
                {fileItem.type.startsWith("image/") ? (
                  <ImageIcon className="size-4" />
                ) : fileItem.type.startsWith("video/") ? (
                  <Film className="size-4" />
                ) : fileItem.type.startsWith("audio/") ? (
                  <Music className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={fileItem.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {fileItem.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {stamp(fileItem.addedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={fileItem.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Preview ${fileItem.name} in a new tab`}
                >
                  <Eye className="size-3.5" />
                  Preview
                </a>
              </Button>
              {!locked ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${fileItem.name}`}
                  disabled={saving}
                  onClick={() => {
                    handleDelete(fileItem);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
        </>
      )}

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => {
          if (!open) handleCancelDialog();
        }}
        onSave={handleSaveAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={handleCancelDialog}
        saving={saving}
      />
    </div>
  );
}

function LineGroup({ title, lines }: { title: string; lines: JobCostLine[] }) {
  if (!lines.length) {
    return (
      <div>
        <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{title}</p>
        <p className="mt-1 text-muted-foreground">No {title.toLowerCase()} on this job.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{title}</p>
      <ul className="mt-2 space-y-2">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{line.description || title}</p>
              <p className="text-xs text-muted-foreground">
                {line.quantity} {line.unit} × {formatMoney(line.unitPrice)}
              </p>
            </div>
            <p className="shrink-0 tabular-nums">{formatMoney(lineTotal(line))}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{formatMoney(value)}</dd>
    </div>
  );
}

function ActivityCard({
  item,
  last = false,
  deleting = false,
  locked = false,
  onEdit,
  onDelete,
}: {
  item: {
    id: string;
    title: string;
    actor?: string;
    at?: string;
    createdAt?: string;
    html?: string;
    description?: string;
  };
  last?: boolean;
  deleting?: boolean;
  locked?: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const timestamp = item.at || item.createdAt || "";
  const content = item.html ?? item.description ?? "";
  const isSiteVisitActivity =
    /site visit|visit scheduled|calendar visit/i.test(item.title || "") ||
    content.includes("Site visit scheduled");
  return (
    <li className="flex gap-3">
      <div className="flex w-5 flex-col items-center">
        <span
          className={cn(
            "mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-card",
            isSiteVisitActivity ? "border-[#003F7D]" : "border-primary",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isSiteVisitActivity ? "bg-[#003F7D]" : "bg-primary",
            )}
          />
        </span>
        {last ? null : (
          <span
            className={cn(
              "my-1 w-px min-h-4 grow border-l border-dashed",
              isSiteVisitActivity
                ? "border-[#003F7D]/40"
                : "border-primary/40",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md px-3 py-2.5",
          last ? "mb-0" : "mb-3",
          isSiteVisitActivity
            ? "border border-[#003F7D]/25 bg-[#e8eef5]/60"
            : "bg-secondary/70",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                isSiteVisitActivity ? "text-[#003F7D]" : "text-primary",
              )}
            >
              {item.actor || "Desk"}
              {timestamp ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({stamp(timestamp)})
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{item.title}</p>
          </div>
          {!locked ? (
            <div className="flex shrink-0 gap-0.5">
              <Button aria-label={`Edit ${item.title}`} size="icon-sm" variant="ghost" disabled={deleting} onClick={onEdit}>
                <Pencil />
              </Button>
              <Button
                aria-label={`Delete ${item.title}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                size="icon-sm"
                variant="ghost"
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 />}
              </Button>
            </div>
          ) : null}
        </div>
        {content ? (
          content.includes("<") ? (
            <div className="job-activity-html mt-1.5 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: safeHtml(content) }} />
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{content}</p>
          )
        ) : null}
      </div>
    </li>
  );
}

function formatLogDetail(detail?: string) {
  if (!detail) return "";
  return detail.replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?/g, (match) =>
    formatShortDate(match),
  );
}

function LogRow({ item, last }: { item: JobLog; last: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex w-4 flex-col items-center">
        <span className="mt-1.5 size-2 rounded-full bg-primary" />
        {last ? null : <span className="w-px flex-1 bg-black/15" />}
      </div>
      <div className={cn("min-w-0 pb-4", last && "pb-0")}>
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">{formatLogDetail(item.detail)}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {item.actor} · {item.at.includes("T") ? stamp(item.at) : formatDate(item.at)}
        </p>
      </div>
    </li>
  );
}

function ActivityDialog({
  open,
  activity,
  saving = false,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  activity?: { id?: string; title: string; html?: string; description?: string } | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, html: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setTitle(activity?.title ?? "");
      setHtml(activity?.html ?? activity?.description ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activity, open]);

  function reset() {
    setTitle("");
    setHtml("");
  }

  const isBusy = saving || submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity ? "Edit activity" : "Add activity"}</DialogTitle>
          <DialogDescription>
            {activity ? "Update the title or note. The change is written to the log." : "Title plus a rich note. It posts to this record."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            Title
            <Input
              disabled={isBusy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Site note, customer call, follow-up…"
            />
          </label>
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Description</span>
            <Textarea
              rows={5}
              disabled={isBusy}
              className="min-h-[120px] resize-y border-border-soft text-sm"
              placeholder={"Description:\nTicket #:\nTicket Information:\nPOC:"}
              value={html.replace(/<[^>]+>/g, "")}
              onChange={(event) => setHtml(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isBusy}
            onClick={async () => {
              if (!title.trim()) {
                toast.error("Add a title.");
                return;
              }
              setSubmitting(true);
              try {
                await onSave(title.trim(), html);
                reset();
              } catch {
                // error toasted by caller
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {isBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            {isBusy ? "Saving…" : activity ? "Save changes" : "Post activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
