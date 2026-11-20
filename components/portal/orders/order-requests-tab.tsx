"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, Eye, RotateCcw, Send } from "lucide-react";
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
import {
  approveOrderCompletion,
  approveOrderScopeRequest,
  declineOrderScopeRequest,
  rejectOrderCompletion,
  sendOrderChangeOrderToCustomer,
} from "@/lib/api/order-crew-client";
import { LineItemsEditor } from "@/components/portal/line-items-editor";
import type { JobCostLine } from "@/components/portal/use-job-costing";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderCrewCompletion, ProviderChangeOrderItem, ProviderOrder } from "@/lib/types/provider-order";

/**
 * Pro order page → Requests: the crew's scope change requests and completion proof, in the same table + review dialog as a
 * job's Requests tab (components/portal/job-requests-tab.tsx / contractor-review-dialog.tsx).
 * Those are bound to job requests, so this mirrors their layout for the order's `crewCompletion`.
 */

type Row =
  | { id: string; kind: "completion"; completion: OrderCrewCompletion }
  | { id: string; kind: "scope"; scope: ProviderChangeOrderItem };

/** Crew ↔ office scope requests on the order (internal, job-style). */
function scopeRequests(order: ProviderOrder) {
  return (order.changeOrders || []).filter((row) => row.audience === "crew");
}

/** Pending items on the order (Requests tab badge): a completion to review + scope requests to price. */
export function orderPendingRequests(order: ProviderOrder) {
  return (
    (order.crewCompletion?.status === "pending" ? 1 : 0) +
    (order.changeOrders || []).filter((row) => row.audience === "crew" && row.status === "REQUESTED").length
  );
}

function CompletionPill({ status }: { status: OrderCrewCompletion["status"] }) {
  if (status === "approved") return <StatusPill tone="success" label="Approved" />;
  if (status === "rejected") return <StatusPill tone="danger" label="Re-work requested" />;
  return <StatusPill tone="warning" label="Pending provider review" />;
}

/** Scope request status — same words as a job's change request. */
function ScopePill({ row }: { row: ProviderChangeOrderItem }) {
  if (row.status === "REQUESTED") return <StatusPill tone="warning" label="Pending provider review" />;
  if (row.declinedByOffice || row.status === "REJECTED") return <StatusPill tone="danger" label="Declined" />;
  if (row.status === "ACCEPTED") return <StatusPill tone="success" label="Accepted" />;
  return <StatusPill tone="primary" label="Awaiting acceptance" />;
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

function crewPhone(order: ProviderOrder, person?: { id?: string | null } | null) {
  const id = person?.id ? String(person.id) : "";
  if (!id) return "";
  const employee = order.crew?.employees.find((row) => row.employeeId === id);
  const contractor = order.crew?.contractors.find((row) => row.contractorId === id);
  return employee?.phone || contractor?.phone || "";
}

const rowSender = (row: Row) => (row.kind === "completion" ? row.completion.submittedBy : row.scope.requestedBy);
const rowDate = (row: Row) => (row.kind === "completion" ? row.completion.submittedAt : row.scope.createdAt);
const rowPending = (row: Row) => (row.kind === "completion" ? row.completion.status === "pending" : row.scope.status === "REQUESTED");

export function OrderRequestsTab({
  order,
  onDecided,
}: {
  order: ProviderOrder;
  onDecided: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<{ mode: "review" | "reject" } | null>(null);
  const [scopePicked, setScopePicked] = useState<{ row: ProviderChangeOrderItem; mode: "price" | "decline" } | null>(null);
  const completion = order.crewCompletion;
  const rows: Row[] = [
    ...scopeRequests(order).map((scope, index): Row => ({ id: scope.id || `scope-${index}`, kind: "scope", scope })),
    ...(completion && completion.status !== "none"
      ? [{ id: `${order.id}:completion`, kind: "completion" as const, completion }]
      : []),
  ].sort((a, b) => Number(rowPending(b)) - Number(rowPending(a)) || String(rowDate(b) || "").localeCompare(String(rowDate(a) || "")));

  const open = (row: Row, mode?: "reject" | "decline") => {
    if (row.kind === "completion") setPicked({ mode: mode === "reject" ? "reject" : "review" });
    else setScopePicked({ row: row.scope, mode: mode === "decline" ? "decline" : "price" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-foreground">Requests</p>
        <p className="text-xs text-muted-foreground">
          Scope change requests and completion proof from the technicians and contractors on this order.
        </p>
      </div>

      <PortalDataTable
        filename="order-requests"
        countLabel="Request"
        hideSearch
        empty="No requests yet. Technicians and contractors send them from their portal."
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => open(row)}
        rowClassName={(row) => (rowPending(row) ? "bg-amber-50/40" : undefined)}
        columns={[
          {
            id: "requestedBy",
            header: "Requested by",
            className: "min-w-40",
            exportValue: (row) => rowSender(row)?.name || "",
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-foreground">{rowSender(row)?.name || "—"}</span>
                <SenderTag type={rowSender(row)?.type} />
              </div>
            ),
          },
          {
            id: "type",
            header: "Type",
            exportValue: (row) => (row.kind === "completion" ? "Job completion" : "Scope change"),
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm">{row.kind === "completion" ? "Job completion" : "Scope change"}</span>
                {row.kind === "completion" ? <CompletionPill status={row.completion.status} /> : <ScopePill row={row.scope} />}
              </div>
            ),
          },
          {
            id: "details",
            header: "Details",
            className: "min-w-64 max-w-[26rem]",
            exportValue: (row) => (row.kind === "completion" ? row.completion.notes : row.scope.description),
            cell: (row) => {
              if (row.kind === "scope") {
                const sub = [
                  row.scope.reason,
                  row.scope.items?.length ? `${row.scope.items.length} line${row.scope.items.length === 1 ? "" : "s"} · ${formatMoney(row.scope.additionalAmount)}` : "",
                  row.scope.customerChangeOrderId ? "Sent to customer" : "",
                  row.scope.officeNote && `Office: ${row.scope.officeNote}`,
                ];
                return (
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm text-foreground">{row.scope.description}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{sub.filter(Boolean).join(" · ")}</p>
                  </div>
                );
              }
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
            exportValue: (row) => (rowDate(row) ? formatDate(String(rowDate(row))) : ""),
            cell: (row) => (
              <span className="whitespace-nowrap text-sm">{rowDate(row) ? formatDate(String(rowDate(row))) : "—"}</span>
            ),
          },
        ]}
        actions={(row) => [
          { label: "View", icon: <Eye />, onSelect: () => open(row) },
          ...(rowPending(row)
            ? row.kind === "completion"
              ? [
                  { label: "Approve", icon: <CheckCircle2 />, onSelect: () => open(row) },
                  { label: "Reject", icon: <RotateCcw />, variant: "destructive" as const, onSelect: () => open(row, "reject") },
                ]
              : [
                  { label: "Approve", icon: <CheckCircle2 />, onSelect: () => open(row) },
                  { label: "Decline", icon: <RotateCcw />, variant: "destructive" as const, onSelect: () => open(row, "decline") },
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
      {scopePicked ? (
        <OrderScopeRequestDialog
          key={`${scopePicked.row.id}:${scopePicked.mode}`}
          order={order}
          request={scopePicked.row}
          initialMode={scopePicked.mode}
          onOpenChange={(open) => {
            if (!open) setScopePicked(null);
          }}
          onDecided={onDecided}
        />
      ) : null}
    </div>
  );
}

/**
 * Crew scope request review — exactly the job flow: approve it by adding the labour / material /
 * equipment lines (internal, the requester accepts them) or decline it. It never goes to the customer
 * by itself; "Send to customer as change order" is a separate, optional Pro step.
 */
function OrderScopeRequestDialog({
  order,
  request,
  initialMode,
  onOpenChange,
  onDecided,
}: {
  order: ProviderOrder;
  request: ProviderChangeOrderItem;
  initialMode: "price" | "decline";
  onOpenChange: (open: boolean) => void;
  onDecided: () => void | Promise<void>;
}) {
  const pending = request.status === "REQUESTED";
  const [mode, setMode] = useState<"approve" | "decline" | "customer">(
    pending ? (initialMode === "decline" ? "decline" : "approve") : "approve",
  );
  const [title, setTitle] = useState(() => (request.title || request.description || "").slice(0, 120));
  const [lines, setLines] = useState<JobCostLine[]>(() => [
    { id: "extra_1", description: "", kind: "labor", quantity: 1, unit: "hr", unitPrice: 0 },
  ]);
  const [note, setNote] = useState("");
  const [customerText, setCustomerText] = useState(request.title || request.description || "");
  const [customerAmount, setCustomerAmount] = useState(() =>
    request.additionalAmount > 0 ? String(request.additionalAmount) : "",
  );
  const [touched, setTouched] = useState(false);
  const [acting, setActing] = useState<"approve" | "decline" | "customer" | null>(null);
  const busy = Boolean(acting);
  const sender = request.requestedBy;
  const name = sender?.name || "Technician";
  const Who = sender?.type === "contractor" ? "Contractor" : "Technician";
  const who = Who.toLowerCase();
  const phone = crewPhone(order, sender);
  const filledLines = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
  const linesTotal = filledLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0), 0);
  const linesError = !filledLines.length ? "Add at least one line with a description." : null;
  const customerValue = Number(customerAmount);
  const customerAmountError =
    !customerAmount.trim() || !Number.isFinite(customerValue) || customerValue < 1 ? "Enter the amount for the customer (at least $1.00)." : null;
  const customerTextError = customerText.trim().length < 5 ? "Describe the change for the customer (at least 5 characters)." : null;
  const canSendToCustomer =
    !pending && !request.declinedByOffice && !request.customerChangeOrderId && ["ARRIVED", "IN_PROGRESS"].includes(order.status);

  async function approve() {
    setTouched(true);
    if (linesError || !request.id) return;
    setActing("approve");
    try {
      await approveOrderScopeRequest(order.id, request.id, {
        title: title.trim() || undefined,
        note: note.trim() || undefined,
        items: filledLines.map((line) => ({
          description: line.description.trim(),
          kind: line.kind === "labor" ? "labor" : line.kind === "equipment" ? "equipment" : "material",
          quantity: Number(line.quantity) || 1,
          unitPrice: Math.round(Number(line.unitPrice || 0) * 100) / 100,
          unit: line.unit,
        })),
      });
      toast.success(`Scope added. ${name} reviews and accepts it on the job.`);
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not approve this request.");
    } finally {
      setActing(null);
    }
  }

  async function decline() {
    if (!request.id) return;
    setActing("decline");
    try {
      await declineOrderScopeRequest(order.id, request.id, note.trim());
      toast.success(`Scope request declined. ${name} was notified.`);
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not decline this request.");
    } finally {
      setActing(null);
    }
  }

  async function sendToCustomer() {
    setTouched(true);
    if (customerAmountError || customerTextError || !request.id) return;
    setActing("customer");
    try {
      await sendOrderChangeOrderToCustomer(order.id, {
        description: customerText.trim(),
        reason: request.reason || undefined,
        additionalAmount: Math.round(customerValue * 100) / 100,
        fromRequestId: request.id,
      });
      toast.success(`Change order sent to the customer for approval (+${formatMoney(customerValue)}).`);
      onOpenChange(false);
      await onDecided();
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not send the change order.");
    } finally {
      setActing(null);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {mode === "customer" ? "Send to customer as change order" : "Scope change requested"}
            <ScopePill row={request} />
          </DialogTitle>
          <DialogDescription>
            {name}
            {request.createdAt ? ` · requested ${formatDate(request.createdAt)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-md border border-input bg-muted/30 p-3 sm:grid-cols-3">
            <Detail label="Job">
              <span className="font-medium">{order.orderNumber}</span>
              {order.service?.title ? <p className="truncate text-xs text-muted-foreground">{order.service.title}</p> : null}
            </Detail>
            <Detail label={Who}>
              {name}
              {phone ? <p className="text-xs text-muted-foreground">{phone}</p> : null}
            </Detail>
            <Detail label="Reason">{request.reason || "—"}</Detail>
          </div>
          <Detail label={`${Who}'s description`}>
            <p className="whitespace-pre-wrap">{request.description}</p>
          </Detail>

          {mode === "customer" ? (
            <FieldGroup>
              <Field data-invalid={touched && customerTextError ? true : undefined}>
                <FieldLabel htmlFor="scope-customer-text">
                  Description for the customer <span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea
                  id="scope-customer-text"
                  value={customerText}
                  onChange={(event) => setCustomerText(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  disabled={busy}
                />
                {touched && customerTextError ? <FieldError>{customerTextError}</FieldError> : null}
              </Field>
              <Field data-invalid={touched && customerAmountError ? true : undefined}>
                <FieldLabel htmlFor="scope-customer-amount">
                  Amount for the customer (USD) <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="scope-customer-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={customerAmount}
                  onChange={(event) => setCustomerAmount(event.target.value)}
                  placeholder="e.g. 85.00"
                  aria-invalid={touched && Boolean(customerAmountError)}
                  disabled={busy}
                  autoFocus
                />
                {touched && customerAmountError ? (
                  <FieldError>{customerAmountError}</FieldError>
                ) : (
                  <FieldDescription>
                    A separate customer change order — they approve or decline it; approved amounts are added to the order total.
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          ) : !pending ? (
            <>
              {request.items?.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Scope added by the office
                  </p>
                  <LineItemsEditor
                    lines={toEditorLines(request)}
                    onChange={() => undefined}
                    locked
                    allowMaterialImages={false}
                  />
                  <p className="text-right text-sm font-semibold tabular-nums">Total {formatMoney(request.additionalAmount)}</p>
                </div>
              ) : null}
              <div className="rounded-md border border-input px-3 py-2 text-sm">
                <p className="font-medium">
                  {request.declinedByOffice
                    ? `Declined by the office${request.respondedAt ? ` on ${formatDate(request.respondedAt)}` : ""}`
                    : request.status === "ACCEPTED"
                      ? `Accepted by ${request.acceptedBy || name}${request.acceptedAt ? ` on ${formatDate(request.acceptedAt)}` : ""}`
                      : `Waiting for ${name} to accept the updated scope`}
                </p>
                {request.officeNote ? <p className="mt-0.5 text-muted-foreground">{request.officeNote}</p> : null}
                {request.customerChangeOrderId ? (
                  <p className="mt-0.5 text-muted-foreground">A customer change order was sent for this request.</p>
                ) : null}
              </div>
            </>
          ) : mode === "decline" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="scope-decline-note">Note to the {who}</FieldLabel>
                <Textarea
                  id="scope-decline-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  autoFocus
                  placeholder="Optional, e.g. Already covered by the booked service"
                  disabled={busy}
                />
              </Field>
            </FieldGroup>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="scope-approve-title">Title</FieldLabel>
                <Input
                  id="scope-approve-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  disabled={busy}
                />
              </Field>
              <Field data-invalid={touched && linesError ? true : undefined}>
                <FieldLabel>Extra labour, material and equipment</FieldLabel>
                <LineItemsEditor lines={lines} onChange={setLines} locked={busy} allowMaterialImages={false} minLines={1} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Internal — not billed to the customer</span>
                  <span className="font-semibold tabular-nums">Total {formatMoney(linesTotal)}</span>
                </div>
                {touched && linesError ? <FieldError>{linesError}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="scope-approve-note">Note to the {who}</FieldLabel>
                <Input
                  id="scope-approve-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional"
                  disabled={busy}
                />
                <FieldDescription>They see the lines (without prices) and accept the updated scope.</FieldDescription>
              </Field>
            </FieldGroup>
          )}
        </div>

        {pending ? (
          <DialogFooter className="gap-2 sm:justify-between">
            {mode === "decline" ? (
              <>
                <Button variant="ghost" onClick={() => setMode("approve")} disabled={busy}>
                  Back
                </Button>
                <Button variant="destructive" onClick={decline} disabled={busy}>
                  {acting === "decline" ? <Spinner size="sm" className="text-current" label="Declining" /> : <RotateCcw />}
                  Decline request
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("decline")} disabled={busy}>
                  <RotateCcw />
                  Decline
                </Button>
                <Button onClick={approve} disabled={busy}>
                  {acting === "approve" ? <Spinner size="sm" className="text-current" label="Approving" /> : <CheckCircle2 />}
                  Approve &amp; add scope
                </Button>
              </>
            )}
          </DialogFooter>
        ) : mode === "customer" ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setMode("approve")} disabled={busy}>
              Back
            </Button>
            <Button onClick={sendToCustomer} disabled={busy}>
              {acting === "customer" ? <Spinner size="sm" className="text-current" label="Sending" /> : <Send />}
              Send to customer
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2 sm:justify-between">
            {canSendToCustomer ? (
              <Button variant="outline" onClick={() => setMode("customer")}>
                <Send />
                Send to customer as change order
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The office's lines in the job line editor's shape (read-only view). */
function toEditorLines(request: ProviderChangeOrderItem): JobCostLine[] {
  return (request.items || []).map((item, index) => ({
    id: item.id || `${request.id}_${index}`,
    description: item.description,
    kind: item.kind === "labor" ? "labor" : item.kind === "equipment" ? "equipment" : "materials",
    quantity: item.quantity,
    unit: item.unit || (item.kind === "labor" ? "hr" : "ea"),
    unitPrice: item.unitPrice,
  }));
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
  const phone = crewPhone(order, completion.submittedBy);
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
