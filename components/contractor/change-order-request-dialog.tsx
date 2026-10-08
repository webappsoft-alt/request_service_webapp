"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ContractorJob } from "@/lib/api/contractor-portal-client";

type ChangeRequestInput = { description: string; reason: string; estimatedCost: number };
import { useAppDispatch } from "@/store/hooks";
import { submitChangeRequest } from "@/store/contractorPortalSlice";

/**
 * Field staff ask the office for extra material / work on an active job.
 * Contractors submit through the portal store; technicians pass `submit`.
 */
export function ChangeOrderRequestDialog({
  job,
  open,
  onOpenChange,
  submit,
}: {
  job: Pick<ContractorJob, "id" | "number" | "title">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override the contractor submit (technician portal). Throw to show an error. */
  submit?: (input: ChangeRequestInput) => Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const costValue = Number(cost);
  const descriptionError = description.trim().length < 3 ? "Describe the extra material or work needed." : null;
  const costError =
    cost.trim() === "" || !Number.isFinite(costValue) || costValue < 0 ? "Enter an estimated cost (0 or more)." : null;

  function reset() {
    setDescription("");
    setReason("");
    setCost("");
    setTouched(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (descriptionError || costError) return;
    setSubmitting(true);
    if (submit) {
      try {
        await submit({
          description: description.trim(),
          reason: reason.trim(),
          estimatedCost: Math.round(costValue * 100) / 100,
        });
        toast.success("Change order request sent to the office.");
        reset();
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "Could not send your request.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const result = await dispatch(
      submitChangeRequest({
        jobId: job.id,
        description: description.trim(),
        reason: reason.trim(),
        estimatedCost: Math.round(costValue * 100) / 100,
      }),
    );
    setSubmitting(false);
    if (submitChangeRequest.fulfilled.match(result)) {
      toast.success("Change order request sent to the office.");
      reset();
      onOpenChange(false);
    } else {
      toast.error(result.payload || "Could not send your request.");
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Request change order</DialogTitle>
            <DialogDescription>
              {job.number}
              {job.title ? ` · ${job.title}` : ""}. The office will accept it as a formal change order or reply with
              remarks.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={touched && descriptionError ? true : undefined}>
              <FieldLabel htmlFor="co-description">
                Extra material / work needed <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="co-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. Replace 12 ft of corroded copper supply line behind the vanity"
                aria-invalid={touched && Boolean(descriptionError)}
                disabled={submitting}
              />
              {touched && descriptionError ? <FieldError>{descriptionError}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="co-reason">Reason</FieldLabel>
              <Textarea
                id="co-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Why it's needed: what you found on site"
                disabled={submitting}
              />
            </Field>

            <Field data-invalid={touched && costError ? true : undefined}>
              <FieldLabel htmlFor="co-cost">
                Estimated cost <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="co-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  className="pl-6"
                  placeholder="0.00"
                  aria-invalid={touched && Boolean(costError)}
                  disabled={submitting}
                />
              </div>
              {touched && costError ? (
                <FieldError>{costError}</FieldError>
              ) : (
                <FieldDescription>Materials plus labor. The office can adjust it before approving.</FieldDescription>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" className="text-current" label="Sending" /> : <FilePlus2 />}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
