"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Check,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  extractUploadedUrl,
  uploadDoc,
  uploadFile,
} from "@/components/api/uploadFile";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import {
  useJobFile,
  siteVisitFromRecord,
  type EstimateSiteVisit,
  type JobAttachment,
} from "@/components/portal/use-job-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
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

const MAX_FILE = 15 * 1024 * 1024;

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
                  active &&
                    "bg-[#003F7D] text-white shadow-[0_0_0_3px_rgba(0,63,125,0.22)]",
                  done && !active && "bg-[#003F7D] text-white",
                  !done &&
                    !active &&
                    "border border-[#c5ced8] bg-white text-muted-foreground",
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
}: {
  status: EstimateStatus;
  signed: boolean;
  hasJob: boolean;
}) {
  const copy = (() => {
    if (hasJob)
      return {
        title: "Converted to job",
        body: "This estimate is now a job. Open the linked job to continue the work.",
      };
    if (signed || status === "accepted") {
      return {
        title: "Customer signed",
        body: "The quote is approved. Convert it to a job to start the work.",
      };
    }
    switch (status) {
      case "site_visit":
        return {
          title: "Technician on site",
          body: "Capture photos and findings on Site visit, price Line items, then click Finalize estimate. After that you can Share.",
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
        return {
          title: "Waiting on signature",
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
        return {
          title: "Converted to job",
          body: "This estimate was converted. Open the linked job to continue the work.",
        };
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
  onSave: (visit: EstimateSiteVisit) => void | Promise<void>;
}) {
  const { employees, loading: crewLoading } = usePortalCrew();
  const crm = useCrmApiData();
  const loading = crewLoading || (crm.enabled && !crm.ready);
  const { siteVisit, saveSiteVisit, actor } = useJobFile(
    asJob,
    estimate,
    undefined,
    "",
  );
  const fallback: EstimateSiteVisit = siteVisit ??
    siteVisitFromRecord(estimate.siteVisit) ?? {
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
  const visitRef = useRef(visit);
  visitRef.current = visit;
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<JobAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);

  const isDirty = useMemo(() => {
    if (!draft) return false;
    return (
      (draft.employeeId || "") !== (fallback.employeeId || "") ||
      (draft.visitedAt || "") !== (fallback.visitedAt || "") ||
      (draft.accessNotes || "").trim() !==
        (fallback.accessNotes || "").trim() ||
      (draft.findings || "").trim() !== (fallback.findings || "").trim() ||
      (draft.recommendations || "").trim() !==
        (fallback.recommendations || "").trim() ||
      (draft.measurements || "").trim() !==
        (fallback.measurements || "").trim() ||
      draft.photos !== fallback.photos
    );
  }, [draft, fallback]);

  useEffect(() => {
    if (!preview) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

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

  // Intercept navigation or tab change when form has unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handleClickCapture = (event: MouseEvent) => {
      if (bypassingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Allow clicks within the site visit form, modals, dropdowns, toasts
      if (
        target.closest("[data-site-visit-form]") ||
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

      // Check if clicking on an interactive navigation or button element
      const interactiveEl = target.closest(
        "button, a[href], [role='tab'], [role='button'], [data-tab-id]",
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

  function patch(next: Partial<EstimateSiteVisit>) {
    setDraft({ ...visit, ...next });
  }

  async function persist(next: EstimateSiteVisit) {
    visitRef.current = next;
    setDraft(null);
    saveSiteVisit(next);
    await onSave(next);
  }

  async function handleSaveAndLeave() {
    await persist(visit);
    toast.success("Site visit saved.");
    executePending();
  }

  function handleDiscardAndLeave() {
    setDraft(null);
    executePending();
  }

  function handleCancelDialog() {
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
  }

  async function readFiles(list: FileList | File[]) {
    if (locked || uploading) return;
    const files = Array.from(list);
    if (!files.length) return;
    setUploading(true);
    const newPhotos: JobAttachment[] = [];
    try {
      for (const file of files) {
        if (file.size > MAX_FILE) {
          toast.error(`${file.name} is over 15 MB.`);
          continue;
        }
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const response = isPdf ? await uploadDoc(file) : await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${file.name}.`);
        const photo: JobAttachment = {
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${file.name}`,
          name: file.name,
          type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          size: file.size,
          dataUrl: url,
          addedAt: new Date().toISOString(),
          actor,
        };
        newPhotos.push(photo);
      }
      if (newPhotos.length > 0) {
        patch({ photos: [...newPhotos, ...visit.photos] });
        toast.success(
          newPhotos.length === 1
            ? `${newPhotos[0].name} uploaded. Click "Save site" to save.`
            : `${newPhotos.length} photos uploaded. Click "Save site" to save.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "").trim()
            : "";
      toast.error(message || "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length)
      void readFiles(event.dataTransfer.files);
  }

  return (
    <div data-site-visit-form className="space-y-4">
      <div className="roundedlg border border-black/10 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-base font-semibold">
              <Camera className="size-4 text-primary" />
              Site inspection
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What the technician saw on site. Photos and notes stay with this
              estimate until the office finalizes the quote.
            </p>
          </div>
          {locked ? null : (
            <Button
              size="sm"
              disabled={savingNotes}
              onClick={async () => {
                try {
                  setSavingNotes(true);
                  await persist(visit);
                  toast.success("Site visit saved.");
                } catch {
                  // toast shown by onSave handler
                } finally {
                  setSavingNotes(false);
                }
              }}
            >
              {savingNotes ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {savingNotes ? "Saving…" : "Save Site Inspection"}
            </Button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Technician">
            <Select
              disabled={locked || loading}
              value={loading ? undefined : visit.employeeId || "__unassigned__"}
              onValueChange={(value) => {
                const resolvedId = value === "__unassigned__" ? "" : value;
                const employee = employees.find(
                  (item) => item.id === resolvedId,
                );
                patch({
                  employeeId: resolvedId,
                  technician: employee ? employeeName(employee) : "",
                });
              }}
            >
              <SelectTrigger className="w-full" loading={loading}>
                <SelectValue
                  placeholder={loading ? "Loading technicians…" : "Unassigned"}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] w-[var(--radix-select-trigger-width)]"
              >
                {loading ? (
                  <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Loading technicians…</span>
                  </div>
                ) : (
                  <>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {employees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {employeeName(item)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
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
              onChange={(event) =>
                patch({ recommendations: event.target.value })
              }
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
      </div>

      <div className="rounded-[4px] border border-black/10 bg-card p-4">
        <h3 className="text-sm font-semibold">Site photos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pictures from the visit. These stay internal until you send the
          finalized quote.
        </p>
        {locked ? null : (
          <label
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center",
              over
                ? "border-primary bg-[#003F7D]/5"
                : "border-black/20 bg-[#f8fafc]",
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
              {uploading ? "Uploading photos…" : "Drop photos here or browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              Images and PDFs up to 15 MB
            </p>
            <input
              className="sr-only"
              type="file"
              accept="image/*,.pdf"
              multiple
              disabled={uploading}
              onChange={(event) => {
                if (event.target.files?.length)
                  void readFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {visit.photos.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visit.photos.map((file) => (
              <li
                key={file.id}
                className="overflow-hidden rounded-[4px] border border-black/10"
              >
                <button
                  type="button"
                  className="block w-full cursor-pointer"
                  onClick={() => setPreview(file)}
                >
                  {file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={file.name}
                      src={file.dataUrl}
                      className="h-36 w-full object-cover"
                    />
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
                      className="cursor-pointer text-destructive"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        patch({
                          photos: visit.photos.filter(
                            (item) => item.id !== file.id,
                          ),
                        });
                        toast.success(
                          'Photo removed. Click "Save site" to save.',
                        );
                      }}
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
                  className="max-h-[90vh] max-w-[90vw] cursor-default object-contain rounded-md shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : preview.type === "application/pdf" ? (
                <div
                  className="h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg bg-card shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <iframe
                    title={preview.name}
                    src={preview.dataUrl}
                    className="h-full w-full border-none"
                  />
                </div>
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

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => {
          if (!open) handleCancelDialog();
        }}
        onSave={handleSaveAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={handleCancelDialog}
      />
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
