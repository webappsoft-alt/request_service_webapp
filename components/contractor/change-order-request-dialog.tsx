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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ContractorJob } from "@/lib/api/contractor-portal-client";
import { useAppDispatch } from "@/store/hooks";
import { submitChangeRequest } from "@/store/contractorPortalSlice";

type ScopeChangeInput = { description: string; reason: string };

const REASONS = [
  "Unforeseen site condition",
  "Extra material needed",
  "Additional labour needed",
  "Equipment needed",
  "Customer asked on site",
  "Missing from job scope",
  "Other",
];

/**
 * Field staff ask the office for a scope change on an active job. Internal only:
 * the office prices it by adding labour / material / equipment, the requester
 * accepts the updated scope — the customer is never involved.
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
  submit?: (input: ScopeChangeInput) => Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reasonError = reason ? null : "Pick a reason.";
  const descriptionError = description.trim().length < 3 ? "Describe the extra material or work needed." : null;

  function reset() {
    setReason("");
    setDescription("");
    setTouched(false);
  }

  function done() {
    toast.success("Scope change request sent to the office.");
    reset();
    onOpenChange(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (reasonError || descriptionError) return;
    const input = { reason, description: description.trim() };
    setSubmitting(true);
    if (submit) {
      try {
        await submit(input);
        done();
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "Could not send your request.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const result = await dispatch(submitChangeRequest({ jobId: job.id, ...input }));
    setSubmitting(false);
    if (submitChangeRequest.fulfilled.match(result)) done();
    else toast.error(result.payload || "Could not send your request.");
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
            <DialogTitle>Request scope change</DialogTitle>
            <DialogDescription>
              {job.number}
              {job.title ? ` · ${job.title}` : ""}. The office reviews it and adds the labour, material or equipment
              — you then accept the updated scope.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={touched && reasonError ? true : undefined}>
              <FieldLabel htmlFor="scope-reason">
                Reason <span className="text-destructive">*</span>
              </FieldLabel>
              <Select value={reason} onValueChange={setReason} disabled={submitting}>
                <SelectTrigger id="scope-reason" className="w-full" aria-invalid={touched && Boolean(reasonError)}>
                  <SelectValue placeholder="Why is the change needed?" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] w-[var(--radix-select-trigger-width)]">
                  {REASONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched && reasonError ? <FieldError>{reasonError}</FieldError> : null}
            </Field>

            <Field data-invalid={touched && descriptionError ? true : undefined}>
              <FieldLabel htmlFor="scope-description">
                Description <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="scope-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. Replace 12 ft of corroded copper supply line behind the vanity"
                aria-invalid={touched && Boolean(descriptionError)}
                disabled={submitting}
              />
              {touched && descriptionError ? (
                <FieldError>{descriptionError}</FieldError>
              ) : (
                <FieldDescription>No price needed — the office adds the items and cost.</FieldDescription>
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
