"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PhotoGrid, RequestStatusPill } from "@/components/contractor/contractor-ui";
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
import type { ContractorRequest } from "@/lib/api/contractor-portal-client";
import { LineItemsEditor } from "@/components/portal/line-items-editor";
import type { JobCostLine } from "@/components/portal/use-job-costing";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { approveContractorReview, rejectContractorReview } from "@/store/contractorReviewsSlice";

type Mode = "review" | "reject";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Pro-side decision on a contractor submission.
 * - Completion:   "Approve & Mark Job Complete" or "Reject & Request Re-work" (reason required).
 * - Change order: accept → creates a linked draft change order (title / amount editable),
 *                 or decline with remarks (required).
 */
export function ContractorReviewDialog({
  request,
  open,
  onOpenChange,
  onApproved,
  initialMode = "review",
}: {
  request: ContractorRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a successful approval (e.g. open the job's Change Orders tab). */
  onApproved?: (request: ContractorRequest) => void;
  /** "reject" opens straight on the reason form (Reject action in a table row). */
  initialMode?: Mode;
}) {
  const busy = useAppSelector((state) => Boolean(request && state.contractorReviews.acting[request.id]));
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      {/* Keyed so the form starts fresh for every request (content unmounts while closed). */}
      {request ? <ReviewContent key={`${request.id}:${initialMode}`} request={request} onOpenChange={onOpenChange} onApproved={onApproved} initialMode={initialMode} /> : null}
    </Dialog>
  );
}

function ReviewContent({
  request,
  onOpenChange,
  onApproved,
  initialMode,
}: {
  request: ContractorRequest;
  onOpenChange: (open: boolean) => void;
  onApproved?: (request: ContractorRequest) => void;
  initialMode: Mode;
}) {
  const dispatch = useAppDispatch();
  const acting = useAppSelector((state) => state.contractorReviews.acting[request.id]);
  const [mode, setMode] = useState<Mode>(request.status === "pending_pro_approval" ? initialMode : "review");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(() => request.description.slice(0, 120));
  /** The extra's real lines — written by the office; this is what the requester sees and accepts. */
  const [lines, setLines] = useState<JobCostLine[]>(() => [
    { id: "extra_1", description: "", kind: "labor", quantity: 1, unit: "hr", unitPrice: 0 },
  ]);
  const filledLines = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
  const linesTotal = filledLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0), 0);
  function addLine(kind: JobCostLine["kind"]) {
    setLines((current) => [
      ...current,
      { id: `extra_${Date.now()}`, description: "", kind, quantity: 1, unit: kind === "labor" ? "hr" : "ea", unitPrice: 0 },
    ]);
  }
  const [touched, setTouched] = useState(false);

  const isCompletion = request.type === "completion";
  const pending = request.status === "pending_pro_approval";
  const busy = Boolean(acting);
  const reasonError = reason.trim().length < 3 ? "Tell them why (at least a few words)." : null;
  const linesError = !isCompletion && !filledLines.length ? "Add at least one line with a description." : null;
  const contractorName = request.requesterName || request.contractor?.name || "Contractor";
  const who = request.participantType === "technician" ? "technician" : "contractor";
  const Who = request.participantType === "technician" ? "Technician" : "Contractor";

  async function approve() {
    if (linesError) {
      setTouched(true);
      return;
    }
    const result = await dispatch(
      approveContractorReview({
        request,
        note: note.trim() || undefined,
        ...(isCompletion
          ? {}
          : {
              title: title.trim() || undefined,
              amount: Math.round(linesTotal * 100) / 100,
              items: filledLines.map((line) => ({
                description: line.description.trim(),
                kind: line.kind === "labor" ? ("labor" as const) : line.kind === "equipment" ? ("equipment" as const) : ("material" as const),
                quantity: Number(line.quantity) || 1,
                unitPrice: Math.round(Number(line.unitPrice || 0) * 100) / 100,
                unit: line.unit,
              })),
            }),
      }),
    );
    if (approveContractorReview.fulfilled.match(result)) {
      toast.success(
        isCompletion
          ? `${request.job?.number || "Job"} marked complete.`
          : `Change order ${result.payload.changeOrderNumber || ""} created as a draft on ${request.job?.number || "the job"}.`,
      );
      onOpenChange(false);
      onApproved?.(result.payload);
    } else {
      toast.error(result.payload || "Could not approve this request.");
    }
  }

  async function reject() {
    setTouched(true);
    if (reasonError) return;
    const result = await dispatch(rejectContractorReview({ request, reason: reason.trim() }));
    if (rejectContractorReview.fulfilled.match(result)) {
      toast.success(isCompletion ? `Re-work requested from ${contractorName}.` : "Change order request declined.");
      onOpenChange(false);
    } else {
      toast.error(result.payload || "Could not reject this request.");
    }
  }

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {isCompletion ? "Completion submitted" : "Scope change request"}
          <RequestStatusPill status={request.status} type={request.type} />
        </DialogTitle>
        <DialogDescription>
          {contractorName}
          {request.contractor?.trade ? ` · ${request.contractor.trade}` : ""} · submitted {formatDate(request.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-md border border-input bg-muted/30 p-3 sm:grid-cols-3">
          <Detail label="Job">
            {request.job ? (
              <Link
                href={`/pro/dashboard/jobs/${request.job.id}`}
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                {request.job.number}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              "—"
            )}
            {request.job?.title ? <p className="truncate text-xs text-muted-foreground">{request.job.title}</p> : null}
          </Detail>
          <Detail label={Who}>
            {contractorName}
            {(request.contractor?.phone || request.employee?.phone) ? (
              <p className="text-xs text-muted-foreground">{request.contractor?.phone || request.employee?.phone}</p>
            ) : null}
          </Detail>
          {isCompletion ? (
            <Detail label="Photos">{request.photos.length}</Detail>
          ) : (
            <Detail label="Reason">{request.reason || <span className="text-muted-foreground">Not given</span>}</Detail>
          )}
        </div>

        {isCompletion ? (
          <>
            <PhotoGrid photos={request.photos} className="sm:grid-cols-4" />
            <Detail label={`${Who} notes`}>
              {request.notes ? <p className="whitespace-pre-wrap">{request.notes}</p> : <span className="text-muted-foreground">No notes</span>}
            </Detail>
          </>
        ) : (
          <>
            <Detail label="Description">
              <p className="whitespace-pre-wrap">{request.description}</p>
            </Detail>
          </>
        )}

        {!pending ? (
          <div className="rounded-md border border-input px-3 py-2 text-sm">
            <p className="font-medium">
              {request.status === "rejected"
                ? "Rejected"
                : isCompletion
                  ? "Approved"
                  : request.status === "items_added_pending_assignee_acceptance"
                    ? "Items added — awaiting acceptance"
                    : "Items added and accepted"}{" "}
              by {request.reviewedBy || "the office"}
              {request.reviewedAt ? ` on ${formatDate(request.reviewedAt)}` : ""}
              {request.changeOrderNumber ? ` · Change order ${request.changeOrderNumber}` : ""}
            </p>
            {request.reviewNote ? <p className="mt-0.5 text-muted-foreground">{request.reviewNote}</p> : null}
          </div>
        ) : mode === "reject" ? (
          <FieldGroup>
            <Field data-invalid={touched && reasonError ? true : undefined}>
              <FieldLabel htmlFor="review-reason">
                {isCompletion ? "What needs re-work?" : `Remarks for the ${who}`}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="review-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={2000}
                autoFocus
                placeholder={
                  isCompletion
                    ? "e.g. Caulk line at the tub is incomplete, please redo and send new photos"
                    : "e.g. Already covered by the original scope"
                }
                aria-invalid={touched && Boolean(reasonError)}
                disabled={busy}
              />
              {touched && reasonError ? (
                <FieldError>{reasonError}</FieldError>
              ) : (
                <FieldDescription>The {who} sees this {isCompletion ? "and can resubmit" : "on their request"}.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup>
            {!isCompletion ? (
              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="co-title">Title</FieldLabel>
                  <Input
                    id="co-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    disabled={busy}
                  />
                </Field>
                <Field data-invalid={touched && linesError ? true : undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLabel>Extra labour &amp; material</FieldLabel>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addLine("labor")} disabled={busy}>
                        + Labour
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addLine("materials")} disabled={busy}>
                        + Material
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addLine("equipment")} disabled={busy}>
                        + Equipment
                      </Button>
                    </div>
                  </div>
                  <LineItemsEditor lines={lines} onChange={setLines} locked={busy} allowMaterialImages={false} minLines={1} />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {request.estimatedCost > 0 ? `Their old estimate: ${formatMoney(request.estimatedCost)}` : "Internal — not billed to the customer"}
                    </span>
                    <span className="font-semibold tabular-nums">Total {formatMoney(linesTotal)}</span>
                  </div>
                  {touched && linesError ? <FieldError>{linesError}</FieldError> : null}
                </Field>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="review-note">Note to the {who}</FieldLabel>
              <Input
                id="review-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                placeholder="Optional"
                disabled={busy}
              />
              {!isCompletion ? (
                <FieldDescription>
                  The {who} sees these lines on their job and accepts them. It isn&apos;t sent to the customer.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>
        )}
      </div>

      {pending ? (
        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "reject" ? (
            <>
              <Button variant="ghost" onClick={() => setMode("review")} disabled={busy}>
                Back
              </Button>
              <Button variant="destructive" onClick={reject} disabled={busy}>
                {acting === "reject" ? <Spinner size="sm" className="text-current" label="Rejecting" /> : isCompletion ? <RotateCcw /> : <XCircle />}
                {isCompletion ? "Reject & Request Re-work" : "Reject request"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode("reject")} disabled={busy}>
                {isCompletion ? <RotateCcw /> : <XCircle />}
                {isCompletion ? "Reject & Request Re-work" : "Reject"}
              </Button>
              <Button onClick={approve} disabled={busy}>
                {acting === "approve" ? <Spinner size="sm" className="text-current" label="Approving" /> : <CheckCircle2 />}
                {isCompletion ? "Approve & Mark Job Complete" : "Accept"}
              </Button>
            </>
          )}
        </DialogFooter>
      ) : (
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}
