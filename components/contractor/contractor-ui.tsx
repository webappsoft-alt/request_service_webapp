"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hammer, ImagePlus, Loader2, Package, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { SectionedLineItemsEditor } from "@/components/portal/estimate-v2/sectioned-line-items-editor";
import { StatusPill } from "@/components/portal/status-pill";
import type { JobCostLine } from "@/components/portal/use-job-costing";
import type {
  ContractorJob,
  ContractorRequestStatus,
  ContractorRequirement,
} from "@/lib/api/contractor-portal-client";
import { cn } from "@/lib/utils";

/** Portal accent — a muted teal that reads on the soft neutral sidebar. */
export const CONTRACTOR_ACCENT = "var(--ct-accent)";

export function RequestStatusPill({
  status,
  type = "completion",
}: {
  status: ContractorRequestStatus;
  type?: "completion" | "change_order";
}) {
  if (status === "approved") {
    return <StatusPill tone="success" label={type === "completion" ? "Approved" : "Accepted"} />;
  }
  if (status === "rejected") {
    return <StatusPill tone="danger" label={type === "completion" ? "Re-work requested" : "Declined"} />;
  }
  return <StatusPill tone="warning" label="Pending approval" />;
}

/** Where the contractor stands on a job, from their latest completion submission. */
export function CompletionStatePill({ job }: { job: ContractorJob }) {
  if (!job.completion) return null;
  return <RequestStatusPill status={job.completion.status} />;
}

const REQUIREMENT_GROUPS = [
  { kind: "labor", label: "Labor", icon: Hammer },
  { kind: "material", label: "Material", icon: Package },
  { kind: "equipment", label: "Equipment", icon: Truck },
] as const;

export function requirementCount(job: ContractorJob) {
  return job.requirements.labor.length + job.requirements.material.length + job.requirements.equipment.length;
}

/** Compact "3 labor · 2 material · 1 equipment" line for job cards. */
export function RequirementSummary({ job }: { job: ContractorJob }) {
  const parts = REQUIREMENT_GROUPS.map(({ kind, label, icon: Icon }) => {
    const count = job.requirements[kind].length;
    if (!count) return null;
    return (
      <span key={kind} className="inline-flex items-center gap-1">
        <Icon className="size-3.5" aria-hidden />
        {count} {label.toLowerCase()}
      </span>
    );
  }).filter(Boolean);
  if (!parts.length) return <span className="text-muted-foreground">No requirements listed</span>;
  return <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{parts}</span>;
}

const noop = () => undefined;

function toCostLine(item: ContractorRequirement, index: number): JobCostLine {
  const kind = item.kind === "labor" ? "labor" : item.kind === "equipment" ? "equipment" : "materials";
  return {
    id: item.id || `line_${index}`,
    description: item.description,
    kind,
    quantity: item.quantity,
    unit: kind === "labor" ? "hr" : "ea",
    // The office's customer pricing never reaches the contractor portal.
    unitPrice: 0,
    images: item.images,
    section: item.section,
  };
}

/**
 * Labour / material / equipment the job needs — the same sectioned table as
 * the Pro and Technician job views, with the Price / Total columns hidden.
 */
export function RequirementsList({ job }: { job: ContractorJob }) {
  const lines = REQUIREMENT_GROUPS.flatMap(({ kind }) => job.requirements[kind]).map(toCostLine);
  if (!lines.length) {
    return <p className="text-sm text-muted-foreground">The office hasn&apos;t listed specific requirements for this job.</p>;
  }
  return <SectionedLineItemsEditor lines={lines} onChange={noop} locked showPricing={false} />;
}

export function siteLine(job: Pick<ContractorJob, "site">) {
  const { address, city, state, zip } = job.site;
  const tail = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [address, tail].filter(Boolean).join(", ");
}

const MAX_PHOTOS = 20;

/**
 * Drag & drop (or click / paste) proof-of-work photos. Each file uploads as
 * soon as it lands; `value` only ever holds finished public URLs.
 */
export function PhotoDropzone({
  value,
  onChange,
  onUploadingChange,
  disabled = false,
  invalid = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(0);
  // Uploads finish out of order; keep the latest list in a ref so none are lost.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => {
    onUploadingChange?.(pending > 0);
  }, [pending, onUploadingChange]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length < files.length) toast.error("Only image files can be used as proof photos.");
      const room = MAX_PHOTOS - latest.current.length;
      if (room <= 0) {
        toast.error(`Up to ${MAX_PHOTOS} photos per submission.`);
        return;
      }
      const batch = images.slice(0, room);
      if (!batch.length) return;

      setPending((count) => count + batch.length);
      await Promise.all(
        batch.map(async (file) => {
          try {
            const response = await uploadFile(file);
            const url = extractUploadedUrl(response.data);
            if (!url) throw new Error("Upload did not return a URL");
            latest.current = [...latest.current, url];
            onChange(latest.current);
          } catch (error) {
            const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
            toast.error(message || `Could not upload ${file.name}.`);
          } finally {
            setPending((count) => Math.max(0, count - 1));
          }
        }),
      );
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        data-invalid={invalid || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) void addFiles(Array.from(event.dataTransfer.files));
        }}
        onPaste={(event) => {
          if (!disabled) void addFiles(Array.from(event.clipboardData.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          dragging ? "border-[var(--ct-accent)] bg-[var(--ct-accent)]/5" : "border-input hover:bg-muted/50",
          invalid && "border-destructive",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {pending > 0 ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        )}
        <p className="text-sm font-medium text-foreground">
          {pending > 0 ? `Uploading ${pending} photo${pending === 1 ? "" : "s"}…` : "Drop photos of the finished work here"}
        </p>
        <p className="text-xs text-muted-foreground">or click to browse · JPG, PNG, WebP · up to {MAX_PHOTOS}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            void addFiles(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
      </div>

      {value.length ? (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Uploaded photos">
          {value.map((src, index) => (
            <li key={src} className="group relative aspect-square overflow-hidden rounded-md border border-input">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails */}
              <img src={src} alt={`Proof photo ${index + 1}`} className="size-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((url) => url !== src))}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-90 hover:bg-black/80"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Read-only photo strip with click-to-open (used in history and the pro review modal). */
export function PhotoGrid({ photos, className }: { photos: string[]; className?: string }) {
  if (!photos.length) return null;
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}>
      {photos.map((src, index) => (
        <li key={src} className="aspect-square overflow-hidden rounded-md border border-input bg-muted">
          <a href={src} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN images */}
            <img src={src} alt={`Completion photo ${index + 1}`} className="size-full object-cover transition-transform hover:scale-105" />
          </a>
        </li>
      ))}
    </ul>
  );
}
