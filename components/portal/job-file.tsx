"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Eye, FileText, ImageIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EstimateCostChart, JobCostChart, JobCostLegend, JobCosting, type CostingNoun } from "@/components/portal/job-costing";
import { JobRichText } from "@/components/portal/job-rich-text";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
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

const MAX_FILE = 2 * 1024 * 1024;

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobActivity | null>(null);
  const laborLines = lines.filter((line) => line.kind === "labor");
  const materialLines = lines.filter((line) => line.kind === "materials");

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
        {file.activities.length ? (
          <ul className="space-y-3">
            {file.activities.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditing(item);
                  setOpen(true);
                }}
                onDelete={() => {
                  file.removeActivity(item.id);
                  toast.success("Activity deleted.");
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
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
        onSave={(title, html) => {
          if (editing) file.updateActivity(editing.id, title, html);
          else file.addActivity(title, html);
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
}: {
  job: Job;
  estimate?: Estimate;
  invoice?: Invoice;
  technician: string;
  noun?: CostingNoun;
}) {
  const { addLog, locked } = useJobFile(job, estimate, invoice, technician);
  return <JobCosting job={job} locked={locked} noun={noun} onMutate={addLog} />;
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
  const { employees, assign, events } = usePortalCrew();
  const records = usePortalRecords();
  const file = useJobFile(job, estimate, invoice, technician);
  const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
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

  function save() {
    const tech = employees.find((item) => item.id === draft.employeeId);
    const contractor = contractors.find((item) => item.id === draft.employeeId);
    const next = {
      ...draft,
      assignedTo: tech ? employeeName(tech) : contractor ? contractor.companyName : draft.assignedTo,
    };
    file.saveSettings(next);
    records.setStatus("job", job.id, next.status);
    if (next.start && next.employeeId) {
      assign({
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
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Job settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything on this job can be changed here.</p>
        </div>
        <Button size="sm" onClick={save}>
          Save changes
        </Button>
      </div>
      <div className="grid gap-4 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
        <Field label="Job name">
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Status">
          <NativeSelect className="w-full" value={draft.status} onChange={(event) => patch({ status: event.target.value as JobStatus })}>
            {JOB_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {jobStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Customer">
          <NativeSelect className="w-full" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
            {customers.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {crmCustomerName(item)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Assigned technician">
          <NativeSelect className="w-full" value={draft.employeeId} onChange={(event) => patch({ employeeId: event.target.value })}>
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {employees.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {employeeName(item)}
              </NativeSelectOption>
            ))}
            {contractors
              .filter((item) => item.status === "active")
              .map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.companyName} · contractor
                </NativeSelectOption>
              ))}
          </NativeSelect>
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
        <Field label="Job address">
          <Input value={draft.street} onChange={(event) => patch({ street: event.target.value })} />
        </Field>
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
        {logs.map((item, index) => (
          <LogRow key={item.id} item={item} last={index === logs.length - 1} />
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
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<JobAttachment | null>(null);

  function readFiles(list: FileList | File[]) {
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE) {
        toast.error(`${file.name} is over 2 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        addAttachments([
          {
            id: `att_${Date.now()}_${file.name}`,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl: String(reader.result),
            addedAt: new Date().toISOString(),
            actor,
          },
        ]);
        toast.success(`${file.name} attached.`);
      };
      reader.readAsDataURL(file);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) readFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Attachments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Photos, PDFs, and other {noun === "estimate" ? "quote" : noun === "invoice" ? "invoice" : "job"} files. Preview or remove anytime.
      </p>
      <label
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-primary bg-[#003F7D]/5" : "border-black/20 bg-[#f8fafc]",
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
        <Upload className="size-6 text-primary" />
        <p className="text-sm font-medium">Drop files here or browse</p>
        <p className="text-xs text-muted-foreground">PDF, images, and documents up to 2 MB</p>
        <input
          className="sr-only"
          type="file"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) readFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {attachments.length ? (
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-[#eef1f5] text-primary">
                {file.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSize(file.size)} · {stamp(file.addedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPreview(file)}>
                <Eye />
                Preview
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${file.name}`}
                onClick={() => {
                  removeAttachment(file.id);
                  toast.success("Attachment removed.");
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No files on this job yet.</p>
      )}
      <Dialog open={Boolean(preview)} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>{preview ? fileSize(preview.size) : ""}</DialogDescription>
          </DialogHeader>
          {preview?.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={preview.name} src={preview.dataUrl} className="max-h-[28rem] w-full object-contain" />
          ) : preview?.type === "application/pdf" ? (
            <iframe title={preview.name} src={preview.dataUrl} className="h-[28rem] w-full rounded-md border border-black/10" />
          ) : preview ? (
            <a href={preview.dataUrl} download={preview.name} className="text-sm font-medium text-primary underline">
              Download {preview.name}
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
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
  onEdit,
  onDelete,
}: {
  item: JobActivity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-[4px] border border-black/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {item.actor} · {stamp(item.at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button aria-label={`Edit ${item.title}`} size="icon-sm" variant="ghost" onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            aria-label={`Delete ${item.title}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="job-activity-html mt-2 text-sm" dangerouslySetInnerHTML={{ __html: safeHtml(item.html) }} />
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
  onOpenChange,
  onSave,
}: {
  open: boolean;
  activity?: JobActivity | null;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, html: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(activity?.title ?? "");
    setHtml(activity?.html ?? "");
  }, [activity, open]);

  function reset() {
    setTitle("");
    setHtml("");
  }

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
            {activity ? "Update the title or note. The change is written to the log." : "Title plus a rich note. It posts to this job and the log."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            Title
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Site note, customer call, follow-up…" />
          </label>
          <div className="grid gap-1.5 text-sm">
            <span>Description</span>
            {open ? <JobRichText key={activity?.id ?? "new"} value={html} onChange={setHtml} /> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Add a title.");
                return;
              }
              onSave(title.trim(), html);
              reset();
              onOpenChange(false);
              toast.success(activity ? "Activity updated." : "Activity posted.");
            }}
          >
            {activity ? "Save changes" : "Post activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
