"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PhotoGrid } from "@/components/contractor/contractor-ui";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
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
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { approveOrderCompletion, rejectOrderCompletion } from "@/lib/api/order-crew-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderCrewCompletion, ProviderOrder } from "@/lib/types/provider-order";

/**
 * Pro order page → Requests: the crew's completion proof, in the same table + review dialog as a
 * job's Requests tab (components/portal/job-requests-tab.tsx / contractor-review-dialog.tsx).
 * Those are bound to job requests, so this mirrors their layout for the order's `crewCompletion`.
 */

type Row = { id: string; order: ProviderOrder; completion: OrderCrewCompletion };

/** Pending completions on the order (Requests tab badge). */
export function orderPendingRequests(order: ProviderOrder) {
  return order.crewCompletion?.status === "pending" ? 1 : 0;
}

function CompletionPill({ status }: { status: OrderCrewCompletion["status"] }) {
  if (status === "approved") return <StatusPill tone="success" label="Approved" />;
  if (status === "rejected") return <StatusPill tone="danger" label="Re-work requested" />;
  return <StatusPill tone="warning" label="Pending provider review" />;
}

function SenderTag({ type }: { type?: string }) {
  const contractor = type === "contractor";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-4",
        contractor ? "bg-[#e7f5f1] text-[#0f7b68]" : "bg-[#eef3f9] text-[#003f7d]",
      )}
    >
      {contractor ? "Contractor" : "Technician"}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function crewPhone(order: ProviderOrder, completion: OrderCrewCompletion) {
  const id = completion.submittedBy?.id ? String(completion.submittedBy.id) : "";
  if (!id) return "";
  const employee = order.crew?.employees.find((row) => row.employeeId === id);
  const contractor = order.crew?.contractors.find((row) => row.contractorId === id);
  return employee?.phone || contractor?.phone || "";
}

export function OrderRequestsTab({
  order,
  onDecided,
}: {
  order: ProviderOrder;
  onDecided: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<{ mode: "review" | "reject" } | null>(null);
  const completion = order.crewCompletion;
  const rows: Row[] = completion && completion.status !== "none" ? [{ id: `${order.id}:completion`, order, completion }] : [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-foreground">Requests</p>
        <p className="text-xs text-muted-foreground">
          Completion proof from the technicians and contractors on this order.
        </p>
      </div>

      <PortalDataTable
        filename="order-requests"
        countLabel="Request"
        hideSearch
        empty="No requests yet. Technicians and contractors send them from their portal."
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={() => setPicked({ mode: "review" })}
        rowClassName={(row) => (row.completion.status === "pending" ? "bg-amber-50/40" : undefined)}
        columns={[
          {
            id: "requestedBy",
            header: "Requested by",
            className: "min-w-40",
            exportValue: (row) => row.completion.submittedBy?.name || "",
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-foreground">{row.completion.submittedBy?.name || "—"}</span>
                <SenderTag type={row.completion.submittedBy?.type} />
              </div>
            ),
          },
          {
            id: "type",
            header: "Type",
            exportValue: () => "Job completion",
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm">Job completion</span>
                <CompletionPill status={row.completion.status} />
              </div>
            ),
          },
          {
            id: "details",
            header: "Details",
            className: "min-w-64 max-w-[26rem]",
            exportValue: (row) => row.completion.notes,
            cell: (row) => {
              const photos = row.completion.photos.length;
              const sub = [`${photos} photo${photos === 1 ? "" : "s"}`, row.completion.reviewNote && `Office: ${row.completion.reviewNote}`];
              return (
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm text-foreground">{row.completion.notes || "Work completed"}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{sub.filter(Boolean).join(" · ")}</p>
                </div>
              );
            },
          },
          {
            id: "createdAt",
            header: "Created at",
            exportValue: (row) => (row.completion.submittedAt ? formatDate(row.completion.submittedAt) : ""),
            cell: (row) => (
              <span className="whitespace-nowrap text-sm">
                {row.completion.submittedAt ? formatDate(row.completion.submittedAt) : "—"}
              </span>
            ),
          },
        ]}
        actions={(row) => [
          { label: "View", icon: <Eye />, onSelect: () => setPicked({ mode: "review" }) },
          ...(row.completion.status === "pending"
            ? [
                { label: "Approve", icon: <CheckCircle2 />, onSelect: () => setPicked({ mode: "review" }) },
                {
                  label: "Reject",
                  icon: <RotateCcw />,
                  variant: "destructive" as const,
                  onSelect: () => setPicked({ mode: "reject" }),
                },
              ]
            : []),
        ]}
      />

      {completion && completion.status !== "none" ? (
        <OrderCompletionReviewDialog
          key={`${completion.submittedAt}:${picked?.mode}`}
          order={order}
          completion={completion}
          open={Boolean(picked)}
          initialMode={picked?.mode ?? "review"}
          onOpenChange={(open) => {
            if (!open) setPicked(null);
          }}
          onDecided={onDecided}
        />
      ) : null}
    </div>
  );
}

/** Same dialog as a job's "Completion submitted" review. */
function OrderCompletionReviewDialog({
  order,
  completion,
  open,
  initialMode,
  onOpenChange,
  onDecided,
}: {
  order: ProviderOrder;
  completion: OrderCrewCompletion;
  open: boolean;
  initialMode: "review" | "reject";
  onOpenChange: (open: boolean) => void;
  onDecided: () => void | Promise<void>;
}) {
  const pending = completion.status === "pending";
  const [mode, setMode] = useState<"review" | "reject">(pending ? initialMode : "review");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const busy = Boolean(acting);
  const name = completion.submittedBy?.name || "Technician";
  const contractor = completion.submittedBy?.type === "contractor";
  const who = contractor ? "contractor" : "technician";
  const Who = contractor ? "Contractor" : "Technician";
  const phone = crewPhone(order, completion);
  const reasonError = reason.trim().length < 3 ? "Tell them why (at least a few words)." : null;
  const title = order.service?.title || order.service?.servicesName || "";

  async function approve() {
    setActing("approve");
    try {
      await approveOrderCompletion(order.id, note.trim());
      toast.success(`${order.orderNumber || "Order"} marked complete. The customer can now review and sign off.`);
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not approve this request.");
    } finally {
      setActing(null);
    }
  }

  async function reject() {
    setTouched(true);
    if (reasonError) return;
    setActing("reject");
    try {
      await rejectOrderCompletion(order.id, reason.trim());
      toast.success(`Re-work requested from ${name}.`);
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not reject this request.");
    } finally {
      setActing(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Completion submitted
            <CompletionPill status={completion.status} />
          </DialogTitle>
          <DialogDescription>
            {name}
            {completion.submittedAt ? ` · submitted ${formatDate(completion.submittedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-md border border-input bg-muted/30 p-3 sm:grid-cols-3">
            <Detail label="Job">
              <span className="font-medium">{order.orderNumber}</span>
              {title ? <p className="truncate text-xs text-muted-foreground">{title}</p> : null}
            </Detail>
            <Detail label={Who}>
              {name}
              {phone ? <p className="text-xs text-muted-foreground">{phone}</p> : null}
            </Detail>
            <Detail label="Photos">{completion.photos.length}</Detail>
          </div>

          <PhotoGrid photos={completion.photos} className="sm:grid-cols-4" />
          <Detail label={`${Who} notes`}>
            {completion.notes ? (
              <p className="whitespace-pre-wrap">{completion.notes}</p>
            ) : (
              <span className="text-muted-foreground">No notes</span>
            )}
          </Detail>

          {!pending ? (
            <div className="rounded-md border border-input px-3 py-2 text-sm">
              <p className="font-medium">
                {completion.status === "rejected" ? "Rejected" : "Approved"} by the office
                {completion.reviewedAt ? ` on ${formatDate(completion.reviewedAt)}` : ""}
              </p>
              {completion.reviewNote ? <p className="mt-0.5 text-muted-foreground">{completion.reviewNote}</p> : null}
            </div>
          ) : mode === "reject" ? (
            <FieldGroup>
              <Field data-invalid={touched && reasonError ? true : undefined}>
                <FieldLabel htmlFor="order-review-reason">
                  What needs re-work? <span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea
                  id="order-review-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  autoFocus
                  placeholder="e.g. Caulk line at the tub is incomplete, please redo and send new photos"
                  aria-invalid={touched && Boolean(reasonError)}
                  disabled={busy}
                />
                {touched && reasonError ? (
                  <FieldError>{reasonError}</FieldError>
                ) : (
                  <FieldDescription>The {who} sees this and can resubmit.</FieldDescription>
                )}
              </Field>
            </FieldGroup>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="order-review-note">Note to the {who}</FieldLabel>
                <Input
                  id="order-review-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional"
                  disabled={busy}
                />
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
                  {acting === "reject" ? <Spinner size="sm" className="text-current" label="Rejecting" /> : <RotateCcw />}
                  Reject &amp; Request Re-work
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("reject")} disabled={busy}>
                  <RotateCcw />
                  Reject &amp; Request Re-work
                </Button>
                <Button onClick={approve} disabled={busy}>
                  {acting === "approve" ? <Spinner size="sm" className="text-current" label="Approving" /> : <CheckCircle2 />}
                  Approve &amp; Mark Job Complete
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
    </Dialog>
  );
}
