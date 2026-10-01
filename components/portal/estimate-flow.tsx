"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ImageIcon, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type {
  Estimate,
  EstimateSignature,
  EstimateSiteVisitRecord,
  EstimateStatus,
  Job,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import type { JobAttachment } from "@/components/portal/use-job-file";

const STEPS = [
  { id: "site_visit", label: "Site visit" },
  { id: "inspected", label: "Field notes" },
  { id: "finalized", label: "Finalize" },
  { id: "sent", label: "Send" },
  { id: "accepted", label: "Signed" },
  { id: "job", label: "Job" },
] as const;

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
    <div className="overflow-x-auto rounded-[4px] border border-input bg-card px-3 py-4 sm:px-5">
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
                  active &&
                    "bg-[#003F7D] text-white shadow-[0_0_0_3px_rgba(0,63,125,0.22)]",
                  done && !active && "bg-[#003F7D] text-white",
                  !done &&
                    !active &&
                    "border border-input bg-white text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
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
                {skipped ? (
                  <span className="mt-0.5 block font-normal opacity-70">
                    skipped
                  </span>
                ) : null}
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
  signature,
  job,
}: {
  status: EstimateStatus;
  signed: boolean;
  hasJob: boolean;
  signature?: EstimateSignature | null;
  job?: Pick<Job, "id" | "number"> | null;
}) {
  const showSignature =
    Boolean(signature?.signedBy || signature?.signedAt || signature?.imageBase64) &&
    (signed || status === "accepted" || status === "converted_to_job" || hasJob);
  const linkedJob = job?.id ? job : null;

  const copy = (() => {
    if (hasJob || linkedJob)
      return {
        title: linkedJob ? `Converted to job ${linkedJob.number}` : "Converted to job",
        body: linkedJob
          ? `Locked to ${linkedJob.number}. Open the job to continue.`
          : "Open the linked job to continue the work.",
      };
    if (signed || status === "accepted") {
      return {
        title: "Customer signed",
        body: signature?.signedBy
          ? `Signed by ${signature.signedBy}. Convert it to a job to start the work.`
          : "The quote is approved. Convert it to a job to start the work.",
      };
    }
    switch (status) {
      case "site_visit":
        return {
          title: "Team member on site",
          body: "Capture findings and photos on the Site visit tab and save the inspection. Once field notes are saved, you can price line items and finalize.",
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
      case "scheduled":
        return {
          title: "Visit scheduled",
          body: "This estimate is on the calendar. Complete the site visit notes, then finalize and send.",
        };
      case "finalized":
        return {
          title: "Ready to send",
          body: "Share the customer link. They review the full estimate and sign to approve.",
        };
      case "sent":
        return {
          title: "Awaiting signature",
          body: "The customer has the link. After they sign, convert this to a job.",
        };
      case "changes_requested":
        return {
          title: "Changes requested",
          body: "Update the line items, finalize again, and send a new link.",
        };
      case "rejected":
        return {
          title: "Customer declined",
          body: "This estimate was rejected. Archive it or start a new quote.",
        };
      case "expired":
        return {
          title: "Estimate expired",
          body: "Re-issue a new quote or restore this one with a new expiry.",
        };
      case "converted_to_job":
        // Job link already handled above when `linkedJob` / `hasJob` is set.
        return {
          title: "Converted to job",
          body: "Open the linked job to continue the work.",
        };
      default: {
        const _never: never = status;
        return _never;
      }
    }
  })();

  const signedAtLabel = signature?.signedAt
    ? formatDate(signature.signedAt.slice(0, 10))
    : null;
  const signatureSrc = signature?.imageBase64?.trim() || "";

  return (
    <div
      className={
        showSignature || linkedJob
          ? "rounded-[4px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5"
          : "rounded-[4px] border border-input bg-[#f8fafc] px-3.5 py-2.5"
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p
            className={
              showSignature || linkedJob
                ? "text-sm font-semibold text-emerald-900"
                : "text-sm font-semibold text-[#003F7D]"
            }
          >
            {copy.title}
          </p>
          <p
            className={
              showSignature || linkedJob
                ? "mt-0.5 text-xs text-emerald-950"
                : "mt-0.5 text-xs text-muted-foreground"
            }
          >
            {copy.body}
          </p>
        </div>
        {showSignature ? (
          <div className="flex min-w-0 items-center gap-2.5">
            {signatureSrc ? (
              <div className="rounded-[4px] border border-emerald-200 bg-white px-2 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={
                    signature?.signedBy
                      ? `Signature of ${signature.signedBy}`
                      : "Customer signature"
                  }
                  src={signatureSrc}
                  className="h-9 w-32 object-contain"
                />
              </div>
            ) : null}
            <div className="min-w-0 text-xs text-emerald-950">
              {signature?.signedBy ? (
                <p className="font-medium leading-tight">{signature.signedBy}</p>
              ) : null}
              {signedAtLabel ? (
                <p className="leading-tight text-emerald-900/80">
                  Signed {signedAtLabel}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {linkedJob ? (
          <Button size="sm" className="h-8 shrink-0" asChild>
            <Link href={`/pro/dashboard/jobs/${linkedJob.id}`}>
              Open {linkedJob.number}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function visitDateLabel(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "No date";
  const day = raw.slice(0, 10);
  return day ? formatDate(day) : "No date";
}

function allVisitRecords(estimate: Estimate): EstimateSiteVisitRecord[] {
  const visits = Array.isArray(estimate.siteVisits)
    ? estimate.siteVisits.filter(Boolean)
    : [];
  if (visits.length) return visits;
  if (estimate.siteVisit) return [estimate.siteVisit];
  return [];
}

function photoUrl(photo: { url?: string; dataUrl?: string }) {
  return String(photo.url || photo.dataUrl || "").trim();
}

function visitIsPending(entry: EstimateSiteVisitRecord) {
  return entry.detailsPending === true;
}

export function EstimateSiteVisitTab({
  estimate,
  locked,
  onScheduleAnother,
  onAddVisitDetails,
  onEditVisit,
}: {
  estimate: Estimate;
  asJob?: Job;
  locked: boolean;
  onSave?: (visit: import("@/components/portal/use-job-file").EstimateSiteVisit) => void | Promise<void>;
  onActionsChange?: (
    actions: {
      locked: boolean;
      saving: boolean;
      save: () => void;
    } | null,
  ) => void;
  onScheduleAnother?: () => void;
  onAddVisitDetails?: () => void;
  onEditVisit?: (index: number) => void;
}) {
  const visits = useMemo(() => allVisitRecords(estimate), [estimate]);
  const [preview, setPreview] = useState<JobAttachment | null>(null);
  const hasExistingVisit = visits.length > 0;
  const latestPending =
    visits.length > 0 && visitIsPending(visits[visits.length - 1]);

  useEffect(() => {
    if (!preview) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  return (
    <div data-site-visit-form className="space-y-4 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {visits.length > 1
              ? `${visits.length} site visits on this estimate`
              : "Site visit details"}
          </p>
          <p className="text-xs text-muted-foreground">
            Schedule a visit, then add notes and photos. Each visit stays
            separate.
          </p>
        </div>
        {!locked && hasExistingVisit ? (
          latestPending && onAddVisitDetails ? (
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={onAddVisitDetails}
            >
              Add Visit Details
            </Button>
          ) : onScheduleAnother ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={onScheduleAnother}
            >
              Schedule Another Site Visit
            </Button>
          ) : null
        ) : null}
      </div>

      {visits.length > 0 ? (
        <ul className="space-y-3">
          {visits.map((entry, index) => {
            const label =
              String(entry.label || "").trim() || `Site Visit #${index + 1}`;
            const displayLabel = label.startsWith("Site Visit")
              ? label
              : `Site Visit #${index + 1}`;
            const tech =
              String(entry.technician || "").trim() ||
              (entry.employeeId ? "Assigned" : "Unassigned");
            const notes = String(entry.accessNotes || entry.findings || "").trim();
            const photos = Array.isArray(entry.photos) ? entry.photos : [];
            const pending = visitIsPending(entry);
            return (
              <li
                key={entry.id || `${label}-${entry.visitedAt || index}`}
                className="rounded-lg border border-[#003F7D]/20 bg-[#f7fafc] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#003F7D]/10 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#003F7D]">
                        {displayLabel}
                      </p>
                      {pending ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Awaiting details
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Date:</span>{" "}
                      {visitDateLabel(entry.visitedAt || entry.scheduledAt)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Technician:
                      </span>{" "}
                      {tech}
                    </p>
                  </div>
                  {!locked && onEditVisit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onEditVisit(index)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                  ) : null}
                </div>
                {pending ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Scheduled. Use <span className="font-medium">Add Visit Details</span>{" "}
                    or Edit to add notes and photos.
                  </p>
                ) : (
                  <>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {notes || "—"}
                      </p>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Images ({photos.length})
                      </p>
                      {photos.length ? (
                        <ul className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          {photos.map((file, photoIndex) => {
                            const src = photoUrl(file);
                            if (!src) return null;
                            const isImage =
                              String(file.type || "").startsWith("image/") ||
                              /\.(png|jpe?g|gif|webp)$/i.test(file.name || "");
                            return (
                              <li
                                key={file.id || `${src}-${photoIndex}`}
                                className="overflow-hidden rounded-md border border-border-soft bg-card"
                              >
                                <button
                                  type="button"
                                  className="block w-full cursor-pointer"
                                  onClick={() =>
                                    setPreview({
                                      id: file.id || `p_${photoIndex}`,
                                      name: file.name || "Photo",
                                      type: file.type || "image/jpeg",
                                      size: file.size || 0,
                                      dataUrl: src,
                                      addedAt: file.addedAt || "",
                                      actor: file.actor || "",
                                    })
                                  }
                                >
                                  {isImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt={file.name || "Site photo"}
                                      src={src}
                                      className="h-20 w-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-20 items-center justify-center bg-secondary text-primary">
                                      <ImageIcon className="size-5" />
                                    </span>
                                  )}
                                </button>
                                <p className="truncate px-2 py-1.5 text-[11px] font-medium">
                                  {file.name || "Photo"}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No photos for this visit.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
          No site visits yet. Complete the first site visit from estimate setup,
          or schedule one from the calendar.
        </p>
      )}

      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black/85 p-4 sm:p-8 backdrop-blur-sm transition-opacity animate-in fade-in-0 duration-150"
              onClick={() => setPreview(null)}
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/60 text-white/90 transition hover:bg-black/80 hover:text-white hover:scale-105"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
              >
                <X className="size-5" />
              </button>
              {preview.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={preview.name}
                  src={preview.dataUrl}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <a
                  href={preview.dataUrl}
                  download={preview.name}
                  className="cursor-pointer rounded-md bg-white px-6 py-3 text-sm font-semibold shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download {preview.name}
                </a>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
