"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Eye,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Music,
  Pencil,
  Plus,
  Receipt,
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
import { EstimateCostChart, JobCostChart, JobCostLegend, JobCosting, type CostingNoun } from "@/components/portal/job-costing";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { JobRichText } from "@/components/portal/job-rich-text";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { useEstimateActivities } from "@/components/portal/use-estimate-activities";
import { useJobActivities } from "@/components/portal/use-job-activities";
import { patchJobLocally } from "@/store/jobsSlice";
import { jobMoneySheet, lineTotal, useJobCosting, type JobCostLine } from "@/components/portal/use-job-costing";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateEstimate as updateEstimateApi,
  updateEstimateAttachments,
  updateInvoiceAttachments,
  updateJobAttachments,
  assignSchedule,
  updateSchedule,
  resolveCrmObjectId,
} from "@/lib/api/crm-client";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { useAppDispatch } from "@/store/hooks";
import {
  fetchJobDetail,
  patchJobStatus,
  upsertJobItem,
  updateJobRecord,
} from "@/store/jobsSlice";
import { upsertInvoiceItem } from "@/store/invoicesSlice";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import { employeeName, JOB_STATUSES, jobStatusLabel, jobStatusTone, minutesForWindow } from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney, formatShortDate } from "@/lib/format";
import type { Estimate, Invoice, Job, JobStatus } from "@/lib/types";
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
  const [open, setOpen] = useState(false);
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = job.address;

  return (
    <div>
      <nav aria-label="Job breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <Link href="/pro/dashboard/jobs" className="font-semibold text-primary hover:underline">
          Jobs
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">
          {customerLabel} – {service}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-primary">{job.number}</span>
        {estimate ? (
          <>
            <span className="text-muted-foreground">/</span>
            <Link href={`/pro/dashboard/estimates/${estimate.id}`} className="font-semibold text-primary hover:underline">
              {estimate.number}
            </Link>
          </>
        ) : null}
        {invoice ? (
          <>
            <span className="text-muted-foreground">/</span>
            <Link href={`/pro/dashboard/invoices/${invoice.id}`} className="font-semibold text-primary hover:underline">
              {invoice.number}
            </Link>
          </>
        ) : null}
      </nav>
      <button
        type="button"
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide job details" : "Show job details"}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 border border-black/10 bg-[#f8fafc] p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            label="Customer"
            value={
              <Link href={`/pro/dashboard/customers/${job.customerId}`} className="font-semibold text-primary hover:underline">
                {customerLabel}
              </Link>
            }
          />
          {customer && customer.entityKind === "company" && contact ? <Detail label="Contact" value={contact} /> : null}
          <Detail label="Service" value={service} />
          {estimate ? (
            <Detail
              label="Converted from estimate"
              value={
                <Link href={`/pro/dashboard/estimates/${estimate.id}`} className="font-semibold text-primary hover:underline">
                  {estimate.number}
                  {estimate.title ? ` · ${estimate.title}` : ""}
                </Link>
              }
            />
          ) : null}
          <Detail label="Team member" value={technician || "Unassigned"} />
          <Detail
            label="Address"
            value={`${address.street}, ${formatLocation(address.city, address.state, address.zip)}`}
          />
          <Detail label="Start" value={start ? formatDate(start) : "Not scheduled"} />
          <Detail label="Due" value={due ? formatDate(due) : "—"} />
          {customer?.phone ? <Detail label="Phone" value={customer.phone} /> : null}
          {customer?.email ? <Detail label="Email" value={customer.email} /> : null}
        </div>
      ) : null}
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
  onActivitiesChange,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  locked?: boolean;
  onActivitiesChange?: (next: Estimate["activities"]) => void;
}) {
  const dispatch = useAppDispatch();
  const { lines, mix } = useJobCosting(job, {
    // Estimates: prefer line items from the estimate record so Labor/Materials
    // kinds stay aligned with API (and labour spelling repairs), not stale localStorage.
    preferApi: noun === "job" || Boolean(estimate),
  });
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

  const estimateAddress = estimate?.propertyAddress;
  const estimateAddressLine = estimateAddress
    ? [
        estimateAddress.address || estimateAddress.street,
        formatLocation(
          estimateAddress.city,
          estimateAddress.state,
          estimateAddress.zip,
        ),
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {isEstimate && estimate ? (
        <div className="lg:col-span-3">
          <Panel title="Estimate details">
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Customer
              </p>
              <p className="mt-1 font-medium">
                {estimate.customerId ? (
                  <Link
                    href={`/pro/dashboard/customers/${estimate.customerId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {estimate.customerName?.trim() || "Customer"}
                  </Link>
                ) : (
                  estimate.customerName?.trim() || "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Status
              </p>
              <p className="mt-1 font-medium capitalize">
                {String(estimate.status || "").replace(/_/g, " ") || "—"}
              </p>
            </div>
            {estimate.title?.trim() ? (
              <div>
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Title
                </p>
                <p className="mt-1 font-medium">{estimate.title}</p>
              </div>
            ) : null}
            {estimateAddressLine ? (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Address
                </p>
                <p className="mt-1 font-medium">{estimateAddressLine}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Issued
              </p>
              <p className="mt-1 font-medium">
                {estimate.issuedAt ? formatDate(estimate.issuedAt) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Expires
              </p>
              <p className="mt-1 font-medium">
                {estimate.expiresAt ? formatDate(estimate.expiresAt) : "—"}
              </p>
            </div>
            {estimate.customerPhone?.trim() ? (
              <div>
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Phone
                </p>
                <p className="mt-1 font-medium">{estimate.customerPhone}</p>
              </div>
            ) : null}
            {estimate.customerEmail?.trim() ? (
              <div>
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Email
                </p>
                <p className="mt-1 font-medium break-all">{estimate.customerEmail}</p>
              </div>
            ) : null}
            {estimate.notes?.trim() ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap font-medium text-muted-foreground">
                  {estimate.notes}
                </p>
              </div>
            ) : null}
            {estimate.terms?.trim() ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Terms
                </p>
                <p className="mt-1 whitespace-pre-wrap font-medium text-muted-foreground">
                  {estimate.terms}
                </p>
              </div>
            ) : null}
          </div>
          </Panel>
        </div>
      ) : null}
      {isEstimate && estimate?.scheduledDate ? (
        <div className="lg:col-span-3 rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-sky-800 uppercase">
            Scheduled date
          </p>
          <p className="mt-1 font-semibold text-sky-950">
            {formatDate(estimate.scheduledDate)}
          </p>
        </div>
      ) : null}
      <Panel title={noun === "estimate" ? "Quote mix" : "Cost mix"}>
        {noun === "estimate" ? (
          <EstimateCostChart labor={mix.labor} materials={mix.materials} />
        ) : (
          <>
            <JobCostChart labor={mix.labor} materials={mix.materials} />
            <div className="mt-4">
              <JobCostLegend labor={mix.labor} materials={mix.materials} />
            </div>
          </>
        )}
      </Panel>
      <Panel title={noun === "estimate" ? "Quote total" : noun === "invoice" ? "Invoice total" : "Job total"}>
        <div className="space-y-4 text-sm">
          <LineGroup title="Labor" lines={laborLines} />
          <LineGroup title="Materials" lines={materialLines} />
          <dl className="space-y-2 border-t border-black/10 pt-3">
            <MoneyRow label="Subtotal" value={sheet.subtotal} />
            <MoneyRow label="Tax (8.25%)" value={sheet.tax} />
            <MoneyRow label="Total" value={sheet.total} strong />
          </dl>
        </div>
        {noun === "invoice" && invoice ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Paid {formatMoney(invoice.amountPaid)} · balance due {formatMoney(invoice.balanceDue)}.
          </p>
        ) : invoice ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {invoice.number} is on file. Materials lock after the invoice leaves draft.
          </p>
        ) : hasInvoice ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {invoiceHref ? (
              <>
                <Link href={invoiceHref} className="font-semibold text-primary hover:underline">
                  Open invoice
                </Link>
                {" · "}
              </>
            ) : null}
            Materials lock after the invoice leaves draft.
          </p>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">No invoice yet. Costs can still move.</p>
        )}
      </Panel>
      <Panel
        title="Activity"
        action={
          locked ? null : (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus />
              Add activity
            </Button>
          )
        }
      >
        {activities.length ? (
          <ul className="space-y-3">
            {activities.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
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
          <p className="text-sm text-muted-foreground">Nothing posted yet. Add a field note, call, or follow-up.</p>
        )}
      </Panel>
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
}) {
  const dispatch = useAppDispatch();
  const { customers, contractors } = useCrmDirectory();
  const crm = useCrmApiData();
  const useApi = crm.enabled;
  const technicianFilter = useMemo(() => ({ role: "technician" }), []);
  const customerPaging = usePaginatedCrmOptions(useApi ? "customer" : null, useApi);
  const assigneePaging = usePaginatedCrmOptions(
    useApi ? "assignee" : null,
    useApi,
    undefined,
    technicianFilter,
  );
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const { employees, events } = usePortalCrew();
  const event = events.find((item) => item.kind === "job" && item.recordId === job.id);

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
    const base = employees.filter((item) => item.active !== false);
    if (draft.employeeId && !base.some((item) => item.id === draft.employeeId)) {
      const missing = employees.find((item) => item.id === draft.employeeId);
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
  }, [employees, draft.employeeId, draft.assignedTo]);

  const contractorOptions = useMemo(() => {
    const base = contractors.filter((item) => item.status === "active");
    if (
      draft.employeeId &&
      !technicianOptions.some((item) => item.id === draft.employeeId) &&
      !base.some((item) => item.id === draft.employeeId)
    ) {
      const missing = contractors.find((item) => item.id === draft.employeeId);
      if (missing) return [missing, ...base];
    }
    return base;
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
    const rows = useApi
      ? assigneePaging.options
      : [
          ...technicianOptions.map((item) => ({
            id: item.id,
            label: `${employeeName(item)}${item.trade ? ` · ${item.trade}` : ""}`,
          })),
          ...contractorOptions.map((item) => ({
            id: item.id,
            label: `${item.companyName} · Contractor`,
          })),
        ];
    return [{ id: "", label: "Unassigned" }, ...rows];
  }, [useApi, assigneePaging.options, technicianOptions, contractorOptions]);

  const statusValue = JOB_STATUSES.includes(draft.status) ? draft.status : JOB_STATUSES[0];

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
    if (!draft.employeeId) {
      toast.error("Select a team member before saving.");
      return;
    }
    if (!draft.start) {
      toast.error("Set a start date before saving.");
      return;
    }
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
            assignedTo: next.employeeId || next.assignedTo || job.assignedTo,
            assignedEmployeeId: next.employeeId || undefined,
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
      if (next.status && next.status !== updated.status) {
        await dispatch(
          patchJobStatus({ id: job.id, status: next.status, notes: next.notes }),
        ).unwrap();
      }

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

  return (
    <>
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
      <div data-job-settings-form className="rounded-[4px] border border-black/10 bg-card p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Job settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Name, customer, schedule, and site address for this job.
            </p>
          </div>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job name">
            <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </Field>
          <Field label="Status">
            <Select
              value={statusValue}
              onValueChange={(value) => patch({ status: value as JobStatus })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] w-[var(--radix-select-trigger-width)]"
              >
                {JOB_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {jobStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Input value={draft.state} onChange={(event) => patch({ state: event.target.value })} />
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
                href={`/pro/dashboard/estimates/${estimate.id}`}
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
        <section className="overflow-hidden rounded-[4px] border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
          <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-4 py-3">
            <FileText className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Job snapshot</h3>
          </header>
          <div className="space-y-3 px-4 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold tracking-tight">{job.number}</p>
              <StatusPill label={jobStatusLabel(draft.status)} className={jobStatusTone(draft.status)} />
            </div>
            <p className="text-muted-foreground">{draft.name || service || "Untitled job"}</p>
            <dl className="space-y-2.5 border-t border-black/10 pt-3">
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

        <section className="overflow-hidden rounded-[4px] border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
          <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-4 py-3">
            <Receipt className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Billing</h3>
          </header>
          <div className="space-y-3 px-4 py-4 text-sm">
            {hasInvoice ? (
              <>
                <p className="font-medium">
                  {invoice?.number ? `${invoice.number} is on file` : "This job has been invoiced"}
                </p>
                {invoiceHref ? (
                  <Button size="sm" variant="outline" asChild>
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
              <p className="text-xs text-muted-foreground border-t border-black/10 pt-3">
                Source estimate{" "}
                <Link
                  href={`/pro/dashboard/estimates/${estimate.id}`}
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
    <div>
      <h2 className="text-base font-semibold">{noun === "estimate" ? "Estimate log" : noun === "invoice" ? "Invoice log" : "Job log"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {noun === "estimate"
          ? "Every change on this quote is recorded here."
          : noun === "invoice"
            ? "Every change on this invoice is recorded here."
            : "Every change on this job is recorded here."}
      </p>
      <ol className="mt-4 space-y-0">
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
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  locked?: boolean;
  onSave?: (updated: Estimate) => void;
}) {
  const dispatch = useAppDispatch();
  const file = useJobFile(job, estimate, invoice, technician);
  const {
    addAttachments,
    replaceAttachments,
    removeAttachment,
    actor,
    attachments: localAttachments,
  } = file;
  const crm = useCrmApiData();
  const apiReady = crm.enabled && crm.ready;
  const preferApiAttachments = apiReady && noun === "job" && !estimate && !invoice;
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<JobAttachment[] | null>(null);

  const savedAttachments = useMemo<JobAttachment[]>(() => {
    const prefix = estimate?.id ?? invoice?.id ?? job?.id ?? "att";
    const addedAt =
      estimate?.createdAt ?? invoice?.createdAt ?? job?.createdAt ?? new Date().toISOString();

    const fromRecord = (() => {
      const rawList = estimate
        ? estimate.attachments
        : invoice
          ? invoice.attachments
          : job?.attachments;
      if (!rawList || !Array.isArray(rawList)) return [] as JobAttachment[];
      return rawList
        .map((item, index) => toJobAttachmentItem(item, index, prefix, addedAt))
        .filter((item) => Boolean(item.dataUrl));
    })();

    // Prefer API/Redux attachments for live jobs; LS only for offline / estimates.
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
    estimate,
    invoice,
    job?.attachments,
    job?.id,
    job?.createdAt,
    localAttachments,
    preferApiAttachments,
  ]);

  useEffect(() => {
    setDraft(null);
  }, [estimate?.id, invoice?.id, job?.id]);

  const activeAttachments = draft ?? savedAttachments;

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

    if (estimate?.id) {
      const payload = attachmentPayload(nextAttachments);
      const updatedEstimate: Estimate = {
        ...estimate,
        attachments: payload,
      };
      crm.patchEstimate(estimate.id, updatedEstimate);
      onSave?.(updatedEstimate);
      const updated = await updateEstimateAttachments(estimate.id, payload);
      if (updated) {
        crm.patchEstimate(estimate.id, updated);
        onSave?.(updated);
        return updated;
      }
      return updatedEstimate;
    }

    if (invoice?.id) {
      const payload = attachmentPayload(nextAttachments);
      const updated = await updateInvoiceAttachments(invoice.id, payload);
      if (updated) {
        dispatch(upsertInvoiceItem(updated));
        return updated;
      }
      return null;
    }

    // Real job record (not invoice-as-job when invoice is present).
    if (job?.id && noun !== "invoice") {
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
    removeAttachment(fileItem.id);
    toast.success(`${fileItem.name} removed.`);
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
        toast.success(`${nextFile.name} attached.`);
      }
      const current = draft ?? savedAttachments;
      setDraft([...addedList, ...current]);
      addAttachments(addedList);
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

  return (
    <div data-job-attachments-tab>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Attachments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos, PDFs, videos, and other {noun === "estimate" ? "quote" : noun === "invoice" ? "invoice" : "job"} files. Preview or remove anytime.
          </p>
        </div>
        {!locked ? (
          <Button
            type="button"
            size="sm"
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
      {!locked ? (
        <label
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
            over ? "border-primary bg-[#003F7D]/5" : "border-black/20 bg-[#f8fafc]",
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
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
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

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
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
  deleting?: boolean;
  locked?: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const timestamp = item.at || item.createdAt || "";
  const content = item.html ?? item.description ?? "";
  return (
    <li className="rounded-[4px] border border-black/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {item.actor || "Desk"} · {timestamp ? stamp(timestamp) : "Just now"}
          </p>
        </div>
        {!locked ? (
          <div className="flex shrink-0 gap-1">
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
        <div className="job-activity-html mt-2 text-sm" dangerouslySetInnerHTML={{ __html: safeHtml(content) }} />
      ) : null}
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
            <span>Description</span>
            {open ? <JobRichText key={activity?.id ?? "new"} value={html} onChange={setHtml} /> : null}
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
