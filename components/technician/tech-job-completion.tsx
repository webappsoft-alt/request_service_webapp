"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { PhotoDropzone } from "@/components/contractor/contractor-ui";
import { DetailCard } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { submitTechnicianJobCompletion } from "@/lib/api/contractor-portal-client";
import type { TechJobDetail } from "@/lib/api/technician-client";
import { formatDate } from "@/lib/format";
import type { TimeEntry } from "@/lib/time-tracking";
import { useNow } from "@/components/tracking/use-live-workers";

type Completion = TechJobDetail["job"]["completion"];

/** Job statuses where "Mark complete" is closed. */
export const COMPLETION_CLOSED_STATUSES = ["completed", "invoiced", "paid", "cancelled"];

/**
 * When the technician can press "Mark complete": the job is still open, and they have no
 * submission waiting for the office or already approved. A rejected one (re-work) can be resent.
 */
export function completionState(status: string, completion: Completion) {
  if (COMPLETION_CLOSED_STATUSES.includes(status)) return { canComplete: false, reason: `This job is ${status}.` };
  if (completion?.status === "pending_pro_approval") return { canComplete: false, reason: "Waiting for the office to review your proof." };
  if (completion?.status === "approved" || completion?.status === "accepted") return { canComplete: false, reason: "The office approved your work." };
  return { canComplete: true, reason: "" };
}

/** Where the completion stands: waiting, re-work asked for, or approved. */
export function TechCompletionBanner({ completion }: { completion: Completion }) {
  if (!completion) return null;
  if (completion.status === "pending_pro_approval") {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-semibold">Waiting for office approval</p>
        <p className="mt-0.5">
          You submitted completion proof{completion.submittedAt ? ` on ${formatDate(completion.submittedAt)}` : ""}. You&apos;ll
          be notified when the office reviews it.
        </p>
      </div>
    );
  }
  if (completion.status === "rejected") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Re-work requested</p>
        <p className="mt-0.5">{completion.reviewNote || "The office asked for changes before closing this job."}</p>
        <p className="mt-1 text-xs">Fix it, then press Mark complete again with new photos.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p className="font-semibold">Work approved</p>
      <p className="mt-0.5">
        The office approved your work{completion.reviewedAt ? ` on ${formatDate(completion.reviewedAt)}` : ""}.
        {completion.reviewNote ? ` "${completion.reviewNote}"` : ""}
      </p>
    </div>
  );
}

/**
 * Technician "Mark complete": proof photos are required, notes optional. It goes to the office as
 * `pending_pro_approval`; the job only closes once they approve. A running timer is clocked out.
 */
export function TechCompleteJobDialog({
  job,
  open,
  onOpenChange,
  onSubmitted,
}: {
  job: { id: string; number: string; title: string; completion?: Completion };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const rework = job.completion?.status === "rejected";
  const missingPhotos = photos.length === 0;

  function reset() {
    setPhotos([]);
    setNotes("");
    setTouched(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missingPhotos || uploading) return;
    setSubmitting(true);
    try {
      await submitTechnicianJobCompletion(job.id, { photos, notes: notes.trim() });
      toast.success("Sent for approval. You'll be notified when the office reviews it.");
      reset();
      onOpenChange(false);
      onSubmitted();
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not submit your completion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{rework ? "Resubmit completed work" : "Mark as complete"}</DialogTitle>
            <DialogDescription>
              {job.number}
              {job.title ? ` · ${job.title}` : ""}. Add photos of the finished work. The office reviews them before the
              job is closed. If you&apos;re still clocked in, you&apos;ll be clocked out.
            </DialogDescription>
          </DialogHeader>

          {rework && job.completion?.reviewNote ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Re-work requested</p>
              <p className="mt-0.5">{job.completion.reviewNote}</p>
            </div>
          ) : null}

          <FieldGroup>
            <Field data-invalid={touched && missingPhotos ? true : undefined}>
              <FieldLabel>
                Proof photos <span className="text-destructive">*</span>
              </FieldLabel>
              <PhotoDropzone
                value={photos}
                onChange={setPhotos}
                onUploadingChange={setUploading}
                disabled={submitting}
                invalid={touched && missingPhotos}
              />
              {touched && missingPhotos ? <FieldError>Add at least one photo of the completed work.</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="tech-completion-notes">Notes for the office</FieldLabel>
              <Textarea
                id="tech-completion-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Anything they should know: leftover materials, follow-ups, site conditions…"
                disabled={submitting}
              />
              <FieldDescription>Optional.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? <Spinner size="sm" className="text-current" label="Submitting" /> : <CheckCircle2 />}
              {uploading ? "Uploading photos…" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "9:05 AM" from an ISO timestamp ("—" when missing or invalid). */
function clockTime(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

/** Worked seconds for a session: saved for finished ones, counted up to now for the running one. */
function workedSeconds(entry: TimeEntry, now: number) {
  if (entry.status === "completed") return Number(entry.seconds) || 0;
  const paused = entry.pausedSeconds || 0;
  const pausedNow = entry.pausedAt ? Math.max(0, (now - new Date(entry.pausedAt).getTime()) / 1000) : 0;
  const seconds = Math.round((now - new Date(entry.clockInAt).getTime()) / 1000 - paused - pausedNow);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

/** Short worked time: "42s", "12m 05s", "2h 14m". */
function workedLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** "Nov 2" from an ISO timestamp. */
function shortDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Every check-in on this job by this technician: first check-in, last check-out, sessions, and
 * total worked time, then one row per session (pauses not counted). Newest first.
 */
export function TechJobTimeLog({ entries }: { entries: TimeEntry[] }) {
  // Ticks so the running session's time stays current.
  const now = useNow(30_000);
  const sessions = [...entries].sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime());
  const first = sessions[sessions.length - 1];
  const lastOut = sessions.find((entry) => entry.clockOutAt);
  const running = sessions.some((entry) => !entry.clockOutAt);
  const total = sessions.reduce((sum, entry) => sum + workedSeconds(entry, now), 0);

  return (
    <DetailCard title="Check-in activity">
      {sessions.length ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="First check-in" value={clockTime(first.clockInAt)} hint={formatDate(first.clockInAt)} />
            <Stat
              label="Last check-out"
              value={running ? "On the clock" : clockTime(lastOut?.clockOutAt)}
              hint={!running && lastOut?.clockOutAt ? formatDate(lastOut.clockOutAt) : undefined}
            />
            <Stat label="Sessions" value={String(sessions.length)} />
            <Stat label="Total worked" value={workedLabel(total)} hint="Pauses not counted" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-muted/40 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Day</th>
                  <th className="px-3 py-2 text-left font-semibold">Checked in</th>
                  <th className="px-3 py-2 text-left font-semibold">Checked out</th>
                  <th className="px-3 py-2 text-right font-semibold">Worked</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((entry, index) => (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{sessions.length - index}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{shortDay(entry.clockInAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <LogIn className="size-3.5 text-emerald-600" aria-hidden />
                        {clockTime(entry.clockInAt)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {entry.clockOutAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <LogOut className="size-3.5 text-muted-foreground" aria-hidden />
                          {clockTime(entry.clockOutAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                          {entry.pausedAt ? "Paused" : "On the clock"}
                        </span>
                      )}
                      {entry.notes ? <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">{entry.notes}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="size-3.5 text-muted-foreground" aria-hidden />
                        {workedLabel(workedSeconds(entry, now))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No check-ins yet. Clock in when you arrive at the job site.</p>
      )}
    </DetailCard>
  );
}
