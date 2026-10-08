"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PhotoDropzone } from "@/components/contractor/contractor-ui";
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
import type { ContractorJob } from "@/lib/api/contractor-portal-client";
import { useAppDispatch } from "@/store/hooks";
import { submitJobCompletion } from "@/store/contractorPortalSlice";

/**
 * "Mark as complete": proof photos are mandatory, notes optional. The
 * submission goes to the office as `pending_pro_approval` — the job only
 * closes once the pro approves it.
 */
export function CompleteJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: ContractorJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
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
    const result = await dispatch(submitJobCompletion({ jobId: job.id, photos, notes: notes.trim() }));
    setSubmitting(false);
    if (submitJobCompletion.fulfilled.match(result)) {
      toast.success("Sent for approval. We'll let you know when the office reviews it.");
      reset();
      onOpenChange(false);
    } else {
      toast.error(result.payload || "Could not submit your completion.");
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
              job is closed.
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
              <FieldLabel htmlFor="completion-notes">Notes for the office</FieldLabel>
              <Textarea
                id="completion-notes"
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
