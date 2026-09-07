"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { Camera, Check, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useJobFile, type EstimateSiteVisit, type JobAttachment } from "@/components/portal/use-job-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { employeeName } from "@/lib/data/portal";
import type { Estimate, EstimateStatus, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "site_visit", label: "Site visit" },
  { id: "inspected", label: "Field notes" },
  { id: "finalized", label: "Finalize" },
  { id: "sent", label: "Send" },
  { id: "accepted", label: "Signed" },
  { id: "job", label: "Job" },
] as const;

const MAX_FILE = 2 * 1024 * 1024;

export function estimateFlowIndex(args: {
  status: EstimateStatus;
  signed: boolean;
  hasJob: boolean;
  hasSiteVisit: boolean;
}) {
  if (args.hasJob) return 5;
  if (args.signed || args.status === "accepted") return 4;
  if (args.status === "sent") return 3;
  if (args.status === "finalized") return 2;
  if (args.status === "inspected") return 1;
  if (args.status === "site_visit") return 0;
  if (args.status === "changes_requested") return 2;
  if (args.status === "rejected" || args.status === "expired") return 3;
  if (args.status === "draft" && !args.hasSiteVisit) return 2;
  return 0;
}

export function EstimatePipeline({
  status,
  signed,
  hasJob,
  hasSiteVisit,
}: {
  status: EstimateStatus;
  signed: boolean;
  hasJob: boolean;
  hasSiteVisit: boolean;
}) {
  const current = estimateFlowIndex({ status, signed, hasJob, hasSiteVisit });
  const skippedVisit = status === "draft" && !hasSiteVisit && current >= 2;

  return (
    <div className="overflow-x-auto rounded-[4px] border border-black/10 bg-card px-3 py-4 sm:px-5">
      <ol className="flex min-w-[36rem] items-start">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const skipped = skippedVisit && index < 2;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-2 px-1"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[13px] right-[calc(50%+16px)] h-0.5 w-[calc(100%-32px)]",
                    index <= current ? "bg-[#003F7D]" : "bg-[#d4dbe4]",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-card",
                  active && "bg-[#003F7D] text-white shadow-[0_0_0_3px_rgba(0,63,125,0.22)]",
                  done && !active && "bg-[#003F7D] text-white",
                  !done && !active && "border border-[#c5ced8] bg-white text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-center text-xs leading-tight",
                  active && "font-semibold text-[#003F7D]",
                  done && !active && "font-medium text-[#003F7D]",
                  !done && !active && "font-medium text-muted-foreground",
                )}
              >
                {step.label}
                {skipped ? <span className="mt-0.5 block font-normal opacity-70">skipped</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function EstimateStageBanner({
  status,
  signed,
  hasJob,
}: {
  status: EstimateStatus;
  signed: boolean;
  hasJob: boolean;
}) {
  const copy = (() => {
    if (hasJob) return { title: "Job started", body: "The customer signed. The work is now on the jobs board." };
    if (signed || status === "accepted") {
      return { title: "Customer signed", body: "The quote is approved. Convert it to a job to start the work." };
    }
    switch (status) {
      case "site_visit":
        return {
          title: "Technician on site",
          body: "Capture photos, measurements, and findings on the Site visit tab. Then mark inspected.",
        };
      case "inspected":
        return {
          title: "Inspection complete",
          body: "The field notes are in. Price the line items in the office, then finalize the estimate.",
        };
      case "draft":
        return {
          title: "Office draft",
          body: "Write the quote here. Finalize when pricing is ready, then send it to the customer.",
        };
      case "finalized":
        return {
          title: "Ready to send",
          body: "Share the customer link. They review the full estimate and sign to approve.",
        };
      case "sent":
        return { title: "Waiting on signature", body: "The customer has the link. After they sign, convert this to a job." };
      case "changes_requested":
        return { title: "Changes requested", body: "Update the line items, finalize again, and send a new link." };
      case "rejected":
        return { title: "Customer declined", body: "This estimate was rejected. Archive it or start a new quote." };
      case "expired":
        return { title: "Estimate expired", body: "Re-issue a new quote or restore this one with a new expiry." };
      default: {
        const _never: never = status;
        return _never;
      }
    }
  })();

  return (
    <div className="rounded-[4px] border border-black/10 bg-[#f8fafc] px-4 py-3">
      <p className="text-sm font-semibold text-[#003F7D]">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
    </div>
  );
}

export function EstimateSiteVisitTab({
  estimate,
  asJob,
  locked,
  onSave,
}: {
  estimate: Estimate;
  asJob: Job;
  locked: boolean;
  onSave: (visit: EstimateSiteVisit) => void;
}) {
  const { employees } = usePortalCrew();
  const { siteVisit, saveSiteVisit, actor } = useJobFile(asJob, estimate, undefined, "");
  const fallback: EstimateSiteVisit = siteVisit ?? {
    employeeId: "",
    technician: "",
    visitedAt: estimate.issuedAt.slice(0, 10),
    accessNotes: "",
    findings: "",
    recommendations: "",
    measurements: "",
    photos: [],
  };
  const [draft, setDraft] = useState<EstimateSiteVisit | null>(null);
  const visit = draft ?? fallback;
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<JobAttachment | null>(null);

  function patch(next: Partial<EstimateSiteVisit>) {
    setDraft({ ...visit, ...next });
  }

  function persist(next: EstimateSiteVisit) {
    setDraft(next);
    saveSiteVisit(next);
    onSave(next);
  }

  function readFiles(list: FileList | File[]) {
    if (locked) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE) {
        toast.error(`${file.name} is over 2 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const photo: JobAttachment = {
          id: `photo_${Date.now()}_${file.name}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: String(reader.result),
          addedAt: new Date().toISOString(),
          actor,
        };
        persist({ ...visit, photos: [photo, ...visit.photos] });
        toast.success(`${file.name} added to the site visit.`);
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
    <div className="space-y-4">
      <div className="rounded-[4px] border border-black/10 bg-card p-4">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold">
          <Camera className="size-4 text-primary" />
          Site inspection
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What the technician saw on site. Photos and notes stay with this estimate until the office finalizes the quote.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Technician">
            <NativeSelect
              className="w-full"
              disabled={locked}
              value={visit.employeeId}
              onChange={(event) => {
                const employee = employees.find((item) => item.id === event.target.value);
                patch({
                  employeeId: event.target.value,
                  technician: employee ? employeeName(employee) : "",
                });
              }}
            >
              <NativeSelectOption value="">Unassigned</NativeSelectOption>
              {employees.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {employeeName(item)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Visit date">
            <Input
              type="date"
              disabled={locked}
              value={visit.visitedAt}
              onChange={(event) => patch({ visitedAt: event.target.value })}
            />
          </Field>
          <Field label="Access / site notes" className="sm:col-span-2">
            <Textarea
              rows={2}
              disabled={locked}
              placeholder="Gate code, pets, parking, who met you on site"
              value={visit.accessNotes}
              onChange={(event) => patch({ accessNotes: event.target.value })}
            />
          </Field>
          <Field label="Findings" className="sm:col-span-2">
            <Textarea
              rows={4}
              disabled={locked}
              placeholder="What you inspected and what you found"
              value={visit.findings}
              onChange={(event) => patch({ findings: event.target.value })}
            />
          </Field>
          <Field label="Recommended work">
            <Textarea
              rows={3}
              disabled={locked}
              placeholder="Work you would price in the office"
              value={visit.recommendations}
              onChange={(event) => patch({ recommendations: event.target.value })}
            />
          </Field>
          <Field label="Measurements / other detail">
            <Textarea
              rows={3}
              disabled={locked}
              placeholder="Sq ft, fixture counts, serial numbers, anything else"
              value={visit.measurements}
              onChange={(event) => patch({ measurements: event.target.value })}
            />
          </Field>
        </div>
        {locked ? null : (
          <Button
            className="mt-4"
            size="sm"
            onClick={() => {
              persist(visit);
              toast.success("Site visit saved.");
            }}
          >
            Save field notes
          </Button>
        )}
      </div>

      <div className="rounded-[4px] border border-black/10 bg-card p-4">
        <h3 className="text-sm font-semibold">Site photos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Pictures from the visit. These stay internal until you send the finalized quote.</p>
        {locked ? null : (
          <label
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center",
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
            <p className="text-sm font-medium">Drop photos here or browse</p>
            <p className="text-xs text-muted-foreground">Images and PDFs up to 2 MB</p>
            <input
              className="sr-only"
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) readFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {visit.photos.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visit.photos.map((file) => (
              <li key={file.id} className="overflow-hidden rounded-[4px] border border-black/10">
                <button type="button" className="block w-full" onClick={() => setPreview(file)}>
                  {file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={file.name} src={file.dataUrl} className="h-36 w-full object-cover" />
                  ) : (
                    <span className="flex h-36 items-center justify-center bg-[#eef1f5] text-primary">
                      <ImageIcon className="size-6" />
                    </span>
                  )}
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  {locked ? null : (
                    <button
                      type="button"
                      className="text-destructive"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => persist({ ...visit, photos: visit.photos.filter((item) => item.id !== file.id) })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No photos yet.</p>
        )}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPreview(null)}>
          {preview.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={preview.name} src={preview.dataUrl} className="max-h-full max-w-full rounded-[4px]" />
          ) : (
            <a href={preview.dataUrl} download={preview.name} className="rounded-[4px] bg-white px-4 py-3 text-sm font-semibold">
              Download {preview.name}
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
