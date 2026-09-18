"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Eye, FileText, Film, ImageIcon, Loader2, Music, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  extractUploadedUrl,
  uploadAnyFile,
  validateAttachmentFile,
} from "@/components/api/uploadFile";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { EstimateCostChart, JobCostChart, JobCostLegend, JobCosting, type CostingNoun } from "@/components/portal/job-costing";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { JobRichText } from "@/components/portal/job-rich-text";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useEstimateActivities } from "@/components/portal/use-estimate-activities";
import { jobMoneySheet, lineTotal, useJobCosting, type JobCostLine } from "@/components/portal/use-job-costing";
import {
  useJobFile,
  type JobActivity,
  type JobAttachment,
  type JobLog,
  type JobSettingsDraft,
} from "@/components/portal/use-job-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { updateEstimate as updateEstimateApi, updateEstimateAttachments, updateJob as updateJobApi, updateJobStatus as updateJobStatusApi } from "@/lib/api/crm-client";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { employeeName, JOB_STATUSES, jobStatusLabel } from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, Job, JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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
          <Detail label="Technician" value={technician || "Unassigned"} />
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

function stamp(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
}) {
  const { lines, mix } = useJobCosting(job);
  const sheet = jobMoneySheet(mix);
  const file = useJobFile(job, estimate, invoice, technician);
  const crm = useCrmApiData();
  const isEstimate = noun === "estimate" && Boolean(estimate?.id);
  const estimateActivities = useEstimateActivities(
    estimate?.id,
    isEstimate,
    estimate?.activities,
    (next) => {
      if (estimate?.id) {
        crm.patchEstimate(estimate.id, { activities: next });
      }
    },
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; html: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const laborLines = lines.filter((line) => line.kind === "labor");
  const materialLines = lines.filter((line) => line.kind === "materials");

  const activities: Array<{ id: string; title: string; html: string; actor: string; at: string }> = isEstimate
    ? estimateActivities.activities.map((item) => ({
        id: item.id,
        title: item.title,
        html: item.description,
        actor: item.actor || "Desk",
        at: item.createdAt,
      }))
    : file.activities;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
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
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">No invoice yet. Costs can still move.</p>
        )}
      </Panel>
      <Panel
        title="Activity"
        action={
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
        }
      >
        {activities.length ? (
          <ul className="space-y-3">
            {activities.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                deleting={estimateActivities.deletingId === item.id}
                onEdit={() => {
                  setEditing({ id: item.id, title: item.title, html: item.html });
                  setOpen(true);
                }}
                onDelete={async () => {
                  if (isEstimate) {
                    await estimateActivities.deleteActivity(item.id);
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
        saving={saving || (isEstimate && estimateActivities.saving)}
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
  onSave,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
  onSave?: (lines: JobCostLine[]) => void | Promise<void>;
}) {
  const { addLog, locked } = useJobFile(job, estimate, invoice, technician);
  return <JobCosting job={job} locked={locked} noun={noun} onMutate={addLog} onSave={onSave} />;
}

export function JobSettingsTab({
  job,
  estimate,
  invoice,
  technician,
  service,
  start,
  due,
  employeeId,
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  service: string;
  start?: string;
  due?: string;
  employeeId?: string;
}) {
  const { customers, contractors } = useCrmDirectory();
  const crm = useCrmApiData();
  const { employees, assign, events } = usePortalCrew();
  const records = usePortalRecords();
  const file = useJobFile(job, estimate, invoice, technician);
  const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
  const apiReady = crm.enabled && crm.ready;
  const defaults: JobSettingsDraft = file.settings ?? {
    name: service,
    customerId: job.customerId,
    street: job.address.street,
    city: job.address.city,
    state: job.address.state,
    zip: job.address.zip,
    start: start ?? "",
    due: due ?? "",
    employeeId: employeeId ?? event?.employeeId ?? "",
    assignedTo: technician,
    status: records.statusOf("job", job.id, job.status),
    notes: job.notes ?? "",
  };
  const [draft, setDraft] = useState(defaults);
  const selected = customers.find((item) => item.id === draft.customerId);

  function patch(next: Partial<JobSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function save() {
    const tech = employees.find((item) => item.id === draft.employeeId);
    const contractor = contractors.find((item) => item.id === draft.employeeId);
    const next = {
      ...draft,
      assignedTo: tech ? employeeName(tech) : contractor ? contractor.companyName : draft.assignedTo,
    };
    try {
      file.saveSettings(next);
      if (apiReady) {
        await updateJobApi(
          job.id,
          {
            ...job,
            customerId: next.customerId || job.customerId,
            status: next.status,
            notes: next.notes,
            scheduledAt: next.start || job.scheduledAt,
            dueAt: next.due || job.dueAt,
            assignedTo: next.assignedTo || job.assignedTo,
            address: {
              ...job.address,
              street: next.street || job.address.street,
              city: next.city || job.address.city,
              state: next.state || job.address.state,
              zip: next.zip || job.address.zip,
            },
          },
          employees,
        );
        await updateJobStatusApi(job.id, next.status, next.notes);
        await crm.refresh();
      } else {
        records.setStatus("job", job.id, next.status);
      }
      if (next.start && next.employeeId) {
        await assign({
          recordId: job.id,
          kind: "job",
          date: next.start,
          endDate: next.due || next.start,
          timeWindow: event?.timeWindow ?? "morning",
          startMinutes: event?.startMinutes,
          endMinutes: event?.endMinutes,
          employeeId: next.employeeId,
        });
      }
      toast.success("Job settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this job.");
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Job settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything on this job can be changed here.</p>
        </div>
        <Button size="sm" onClick={() => void save()}>
          Save changes
        </Button>
      </div>
      <div className="grid gap-4 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
        <Field label="Job name">
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Status">
          <Select
            value={draft.status}
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
          <Select
            value={draft.customerId}
            onValueChange={(value) => patch({ customerId: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="z-[100] w-[var(--radix-select-trigger-width)]"
            >
              {customers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {crmCustomerName(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigned technician">
          <Select
            value={draft.employeeId || "__unassigned__"}
            onValueChange={(value) => patch({ employeeId: value === "__unassigned__" ? "" : value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="z-[100] w-[var(--radix-select-trigger-width)]"
            >
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {employees.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {employeeName(item)}
                </SelectItem>
              ))}
              {contractors
                .filter((item) => item.status === "active")
                .map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.companyName} · contractor
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date">
          <Input type="date" value={draft.start} onChange={(event) => patch({ start: event.target.value })} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={draft.due} onChange={(event) => patch({ due: event.target.value })} />
        </Field>
        {selected?.phone ? (
          <Field label="Customer phone">
            <Input readOnly value={selected.phone} />
          </Field>
        ) : null}
        {selected?.email ? (
          <Field label="Customer email">
            <Input readOnly value={selected.email} />
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Job address">
            <AddressAutocomplete
              id="job-settings-address"
              value={draft.street}
              onChange={(value) => patch({ street: value })}
              onSelect={(address: PlaceAddress) =>
                patch({
                  street: address.formattedAddress || address.streetAddress,
                  city: address.city || "",
                  state: address.state || "",
                  zip: address.zipCode || "",
                })
              }
              placeholder="Start typing a street address…"
            />
          </Field>
        </div>
        <Field label="City">
          <Input value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
        </Field>
        <Field label="ZIP">
          <Input value={draft.zip} onChange={(event) => patch({ zip: event.target.value })} />
        </Field>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Notes</span>
          <Textarea rows={4} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
        </label>
      </div>
    </div>
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
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
}) {
  const { attachments, addAttachments, removeAttachment, actor } = useJobFile(job, estimate, invoice, technician);
  const crm = useCrmApiData();
  const apiReady = crm.enabled;
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fallbackSavedUrls = useMemo(() => {
    return (estimate?.attachments ?? [])
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return String(record.attachment || record.dataUrl || record.url || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }, [estimate?.attachments]);

  const [lastSavedUrls, setLastSavedUrls] = useState<string[]>(fallbackSavedUrls);

  const fallbackSavedKey = fallbackSavedUrls.join("|");
  useEffect(() => {
    setLastSavedUrls(fallbackSavedUrls);
  }, [fallbackSavedKey]);

  const isDirty = useMemo(() => {
    if (!estimate) return false;
    const currentUrls = attachments
      .map((item) => (item.dataUrl || "").trim())
      .filter(Boolean);
    if (currentUrls.length !== lastSavedUrls.length) return true;
    return currentUrls.some((url, idx) => url !== lastSavedUrls[idx]);
  }, [estimate, attachments, lastSavedUrls]);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Window beforeunload (tab close / refresh)
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

  // Intercept navigation or tab change when attachments have unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handleClickCapture = (event: MouseEvent) => {
      if (bypassingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Allow clicks within the attachments tab, modals, dropdowns, selects, toasts
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

  async function persistEstimateAttachments(nextAttachments: JobAttachment[]) {
    if (!estimate || !apiReady) return;
    const attachmentPayload = nextAttachments
      .map((item) => ({
        name: (item.name || "").trim() || "Attachment",
        attachment: (item.dataUrl || "").trim(),
      }))
      .filter((item) => Boolean(item.attachment));

    const updated = await updateEstimateAttachments(estimate.id, attachmentPayload);
    if (updated) {
      crm.patchEstimate(estimate.id, updated);
    } else {
      crm.patchEstimate(estimate.id, { attachments: attachmentPayload });
    }
    if (crm.ready) {
      void crm.refresh({ silent: true });
    }
    return updated;
  }

  async function handleSave() {
    if (!estimate) return;
    setSaving(true);
    try {
      if (apiReady) {
        await persistEstimateAttachments(attachments);
      }
      setLastSavedUrls(attachments.map((item) => (item.dataUrl || "").trim()).filter(Boolean));
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
      await persistEstimateAttachments(attachments);
      setLastSavedUrls(attachments.map((item) => (item.dataUrl || "").trim()).filter(Boolean));
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
    attachments.forEach((item) => {
      const url = (item.dataUrl || "").trim();
      if (!lastSavedUrls.includes(url)) {
        removeAttachment(item.id);
      }
    });
    executePending();
  }

  function handleCancelDialog() {
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
  }

  async function handleDelete(file: JobAttachment) {
    if (deletingId) return;
    setDeletingId(file.id);
    try {
      const remaining = attachments.filter((item) => item.id !== file.id);
      removeAttachment(file.id);
      if (estimate && apiReady) {
        await persistEstimateAttachments(remaining);
      }
      setLastSavedUrls(remaining.map((item) => (item.dataUrl || "").trim()).filter(Boolean));
      toast.success("Attachment removed.");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not update attachments on server.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  async function readFiles(list: FileList | File[]) {
    if (uploading) return;
    const files = Array.from(list);
    if (!files.length) return;

    // Validate all files upfront to prevent invalid requests from hitting the API
    for (const file of files) {
      const check = validateAttachmentFile(file);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
    }

    setUploading(true);
    try {
      const addedList: JobAttachment[] = [];
      for (const file of files) {
        const response = await uploadAnyFile(file);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${file.name}.`);
        const item: JobAttachment = {
          id: `att_${Date.now()}_${file.name}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: url,
          addedAt: new Date().toISOString(),
          actor,
        };
        addedList.push(item);
        toast.success(`${file.name} attached.`);
      }
      addAttachments(addedList);
      if (estimate && apiReady) {
        const combined = [...addedList, ...attachments];
        await persistEstimateAttachments(combined);
        setLastSavedUrls(combined.map((item) => (item.dataUrl || "").trim()).filter(Boolean));
      }
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

  return (
    <div data-job-attachments-tab>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Attachments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos, PDFs, videos, and other {noun === "estimate" ? "quote" : noun === "invoice" ? "invoice" : "job"} files. Preview or remove anytime.
          </p>
        </div>
        {estimate ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || uploading}
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
      {attachments.length ? (
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-[#eef1f5] text-primary">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="size-4" />
                ) : file.type.startsWith("video/") ? (
                  <Film className="size-4" />
                ) : file.type.startsWith("audio/") ? (
                  <Music className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={file.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {file.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {fileSize(file.size)} · {stamp(file.addedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={file.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Preview ${file.name} in a new tab`}
                >
                  <Eye className="size-3.5" />
                  Preview
                </a>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${file.name}`}
                disabled={deletingId === file.id || saving}
                onClick={() => {
                  void handleDelete(file);
                }}
              >
                {deletingId === file.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No files on this job yet.</p>
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
      </div>
      {content ? (
        <div className="job-activity-html mt-2 text-sm" dangerouslySetInnerHTML={{ __html: safeHtml(content) }} />
      ) : null}
    </li>
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
        <p className="text-sm text-muted-foreground">{item.detail}</p>
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
