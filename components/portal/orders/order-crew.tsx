"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Handshake,
  HardHat,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { AssignContractorDialog, type ContractorAssignTarget } from "@/components/portal/job-crew";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { StatusPill } from "@/components/portal/status-pill";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
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
import {
  assignOrderContractor,
  convertOrderToInvoice,
  crewOrderCheckIn,
  crewOrderCheckOut,
  removeOrderContractor,
  removeOrderEmployee,
  setOrderEmployees,
} from "@/lib/api/order-crew-client";
import { getContractorActiveEntry } from "@/lib/api/contractor-portal-client";
import { getTechnicianActiveEntry } from "@/lib/api/technician-client";
import { getDeviceLocation, LocationError } from "@/lib/geolocation";
import { formatMoney } from "@/lib/format";
import type { TimeEntry } from "@/lib/time-tracking";
import type { JobContractorAssignment } from "@/lib/types";
import type { OrderCrewContractor, OrderCrewEmployee, ProviderOrder } from "@/lib/types/provider-order";

/**
 * Crew on a Fixed Service Order — the same employee / contractor assignment as Estimate → Jobs
 * (components/portal/job-crew.tsx), reusing its contractor dialog. Anyone who has started work
 * (checked in or moved the order through a step) can't be removed.
 */

/** Crew can't be changed once the order is finished or cancelled (same rule as the API). */
const CREW_LOCKED = new Set(["WORK_COMPLETED", "SETTLED", "CANCELLED"]);

/**
 * The API's own reason (e.g. "You are 2.4 km from the job site…"), not axios's generic
 * "Request failed with status code 400". Previous: read error.message only.
 */
function errorText(error: unknown, fallback: string) {
  const message = extractErrorMessage(error);
  return message && message !== "Something went wrong. Please try again." ? message : fallback;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function timeLabel(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function windowLabel(row: Pick<OrderCrewContractor, "startAt" | "endAt">) {
  if (!row.startAt) return "";
  return row.endAt ? `${timeLabel(row.startAt)} → ${timeLabel(row.endAt)}` : timeLabel(row.startAt);
}

function termsLabel(row: Pick<OrderCrewContractor, "payType" | "payRate">) {
  return row.payType === "fixed" ? `Fixed ${formatMoney(row.payRate || 0)}` : `${formatMoney(row.payRate || 0)}/hr`;
}

/** Work state chip: checked in now → started → not started yet. */
function WorkState({ member }: { member: Pick<OrderCrewEmployee, "checkedIn" | "started" | "firstCheckInAt"> }) {
  if (member.checkedIn) return <StatusPill tone="success" label="Checked in" />;
  if (member.started) {
    return (
      <StatusPill
        tone="primary"
        label={member.firstCheckInAt ? `Started ${timeLabel(member.firstCheckInAt)}` : "Started"}
      />
    );
  }
  return <StatusPill tone="neutral" label="Not started" />;
}

const removeLockHint = (member: { started: boolean }, locked: boolean) =>
  locked
    ? "This order is finished — its crew can no longer be changed."
    : member.started
      ? "Already started work on this order — can't be removed."
      : undefined;

/** The order as the shared assign-contractor dialog expects it. */
export function orderAssignTarget(order: ProviderOrder): ContractorAssignTarget {
  return {
    id: order.id,
    number: order.orderNumber || order.id.slice(-8).toUpperCase(),
    title: order.service?.title || "",
    scheduledAt: order.booking?.startTime,
    dueAt: order.booking?.endTime,
    crewContractors: (order.crew?.contractors || []).map((row) => toAssignment(row)),
  };
}

function toAssignment(row: OrderCrewContractor): JobContractorAssignment {
  return {
    contractorId: row.contractorId,
    name: row.name,
    trade: row.trade,
    hasPortalAccess: row.hasPortalAccess,
    title: row.title || "",
    instructions: row.instructions || "",
    startAt: row.startAt || null,
    endAt: row.endAt || null,
    payType: row.payType || "hourly",
    payRate: Number(row.payRate) || 0,
    estimatedHours: 0,
  };
}

/* ───────────────────────────── Crew check-in / check-out ───────────────────────────── */

/** Statuses an assigned worker can check in on (same as the API). */
/** Open statuses the crew can clock in on (same as the API). */
const CLOCK_STATUSES = new Set(["CONFIRMED", "IN_TRANSIT", "ARRIVED", "IN_PROGRESS", "CHANGE_ORDER_PENDING"]);

function clockTime(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Technician / contractor portal: "Time on this job" card on a fixed-price order — the same look
 * and flow as a job (ClockControl): Clock In on site (200 m) starts the work, Clock Out stops the
 * clock. Previous: Depart → Arrive → Start work steps plus separate Check in / Check out buttons.
 */
export function CrewOrderClockCard({
  order,
  portal,
  onChanged,
}: {
  order: ProviderOrder;
  portal: "technician" | "contractor";
  onChanged: () => void | Promise<void>;
}) {
  const [active, setActive] = useState<TimeEntry | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const loadActive = useCallback(async () => {
    try {
      setActive(await (portal === "contractor" ? getContractorActiveEntry() : getTechnicianActiveEntry()));
    } catch {
      setActive(null);
    }
  }, [portal]);

  useEffect(() => {
    void loadActive();
  }, [loadActive, order.status]);

  const onThisOrder = Boolean(active && active.order?.id === order.id);
  const elsewhere = Boolean(active && !onThisOrder);
  // Clock-in is locked while the office reviews the completion (same as a job).
  const reviewing = order.crewCompletion?.status === "pending";
  const open = CLOCK_STATUSES.has(order.status) && !reviewing;

  async function run(kind: "in" | "out") {
    if (busy) return;
    setBusy(true);
    try {
      const location = await getDeviceLocation();
      if (kind === "in") await crewOrderCheckIn(portal, order.id, location);
      else await crewOrderCheckOut(portal, order.id, location);
      toast.success(kind === "in" ? "Clocked in. Work started." : "Clocked out.");
      await loadActive();
      await onChanged();
    } catch (err) {
      if (err instanceof LocationError) toast.error(err.title, { description: err.message });
      else toast.error(errorText(err, kind === "in" ? "Could not clock in." : "Could not clock out."));
    } finally {
      setBusy(false);
    }
  }

  const elsewhereLabel = active?.job?.number || active?.estimate?.number || active?.order?.number || "another job";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-input bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Time on this job</p>
        <p className="mt-1 text-sm">
          {onThisOrder
            ? `Clocked in${clockTime(active?.clockInAt) ? ` since ${clockTime(active?.clockInAt)}` : ""}.`
            : open || reviewing
              ? "Not clocked in."
              : `This job is ${order.status.toLowerCase().replace(/_/g, " ")}; clocking in is closed.`}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {reviewing
            ? "You marked this job complete. Clock-in is locked while the office reviews it."
            : elsewhere
            ? `You're clocked in on ${elsewhereLabel}. Clock out there first.`
            : "Location must be on. You can check in/out within 200 m of the job site."}
        </p>
      </div>
      {onThisOrder ? (
        <Button
          size="lg"
          className="h-11 min-w-44 gap-2 bg-red-600 text-white hover:bg-red-700"
          disabled={busy}
          onClick={() => void run("out")}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Clock Out
        </Button>
      ) : open ? (
        <Button
          size="lg"
          className="h-11 min-w-44 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={busy || active === undefined || elsewhere}
          onClick={() => void run("in")}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Clock In
        </Button>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Assign employee dialog ───────────────────────────── */

export function AssignOrderEmployeeDialog({
  order,
  open,
  onOpenChange,
  onSaved,
}: {
  order: ProviderOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <AssignEmployeeForm order={order} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function AssignEmployeeForm({
  order,
  onOpenChange,
  onSaved,
}: {
  order: ProviderOrder;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const paging = usePaginatedCrmOptions("employee", true);
  const current = (order.crew?.employees || []).map((row) => row.employeeId);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const label = order.orderNumber || "this order";

  const error = !employeeId
    ? "Choose an employee."
    : current.includes(employeeId)
      ? "This employee is already on the order."
      : null;

  async function save() {
    setTouched(true);
    if (error || saving) return;
    setSaving(true);
    try {
      await setOrderEmployees(order.id, [...current, employeeId]);
      toast.success(`${employeeLabel || "Employee"} assigned to ${label}.`);
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err, "Could not assign the employee."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md" data-lenis-prevent onInteractOutside={(event) => saving && event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Assign employee · {label}</DialogTitle>
        <DialogDescription>
          They get the order in their technician portal (with a notification and email), and can depart,
          check in on site, raise change orders and submit completion proof.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={touched && error ? true : undefined}>
          <FieldLabel htmlFor="order-employee">Employee</FieldLabel>
          <PaginatedEntitySelect
            id="order-employee"
            value={employeeId}
            selectedLabel={employeeLabel}
            options={paging.options.filter((option) => !current.includes(option.id))}
            placeholder="Select employee"
            emptyLabel={paging.search ? "No employees match." : "No employees yet."}
            loading={paging.loading}
            loadingMore={paging.loadingMore}
            hasMore={paging.hasMore}
            onLoadMore={paging.loadMore}
            searchable
            searchValue={paging.search}
            onSearchChange={paging.setSearch}
            searchPlaceholder="Search employees…"
            onChange={(id, option) => {
              setEmployeeId(id);
              setEmployeeLabel(option?.label || "");
            }}
          />
          <FieldDescription>The booked time for this order is their schedule.</FieldDescription>
          {touched && error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Assign employee
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ───────────────────────────── Header buttons (Pro) ───────────────────────────── */

/** "Assign contractor" + "Assign employee" for the order header — same buttons as a job. */
export function OrderCrewActions({ order, onChanged }: { order: ProviderOrder; onChanged: () => void | Promise<void> }) {
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [contractorOpen, setContractorOpen] = useState(false);
  if (CREW_LOCKED.has(order.status)) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 border-border-soft text-xs" onClick={() => setContractorOpen(true)}>
        <Handshake className="size-3.5 text-primary" />
        Assign contractor
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 border-border-soft text-xs" onClick={() => setEmployeeOpen(true)}>
        <HardHat className="size-3.5 text-primary" />
        Assign employee
      </Button>
      <AssignOrderEmployeeDialog order={order} open={employeeOpen} onOpenChange={setEmployeeOpen} onSaved={onChanged} />
      <AssignContractorDialog
        job={orderAssignTarget(order)}
        recordLabel="order"
        open={contractorOpen}
        onOpenChange={setContractorOpen}
        assign={(input) => assignOrderContractor(order.id, input)}
        onSaved={onChanged}
      />
    </>
  );
}

/* ───────────────────────────── Crew card ───────────────────────────── */

/**
 * Summary-tab crew card: employees in the job "Assigned technician" style, contractors in the job
 * contractors list style. `viewer` = "provider" shows edit / remove; crew portals show it read-only.
 */
export function OrderCrewCard({
  order,
  onChanged,
  viewer = "provider",
}: {
  order: ProviderOrder;
  onChanged: () => void | Promise<void>;
  viewer?: "provider" | "technician" | "contractor";
}) {
  const employees = order.crew?.employees || [];
  const contractors = order.crew?.contractors || [];
  const isPro = viewer === "provider";
  const locked = CREW_LOCKED.has(order.status);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderCrewContractor | null>(null);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const label = order.orderNumber || "this order";
  const lastActor = order.crew?.lastActor;

  async function removeEmployee(row: OrderCrewEmployee) {
    if (removing || !window.confirm(`Remove ${row.name} from ${label}?`)) return;
    setRemoving(row.employeeId);
    try {
      await removeOrderEmployee(order.id, row.employeeId);
      toast.success(`${row.name} removed from this order.`);
      await onChanged();
    } catch (err) {
      toast.error(errorText(err, "Could not remove the employee."));
    } finally {
      setRemoving(null);
    }
  }

  async function removeContractor(row: OrderCrewContractor) {
    if (removing || !window.confirm(`Remove ${row.name} from ${label}?`)) return;
    setRemoving(row.contractorId);
    try {
      await removeOrderContractor(order.id, row.contractorId);
      toast.success(`${row.name} removed from this order.`);
      await onChanged();
    } catch (err) {
      toast.error(errorText(err, "Could not remove the contractor."));
    } finally {
      setRemoving(null);
    }
  }

  if (!employees.length && !contractors.length) {
    if (!isPro || locked) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-input bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-background text-muted-foreground" aria-hidden>
            <HardHat className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Crew</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">No one assigned yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assign an employee or contractor — they depart, check in on site and complete the work from their portal.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 bg-background" onClick={() => setEmployeeOpen(true)}>
          Assign
        </Button>
        <AssignOrderEmployeeDialog order={order} open={employeeOpen} onOpenChange={setEmployeeOpen} onSaved={onChanged} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {employees.map((row) => (
        <div
          key={row.employeeId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-gradient-to-r from-primary/[0.07] via-primary/[0.03] to-transparent px-4 py-3 shadow-xs"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
              {initials(row.name)}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Assigned technician
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {isPro ? (
                  <Link href={`/pro/dashboard/team/${row.employeeId}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold text-foreground">{row.name}</span>
                )}
                <WorkState member={row} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[row.trade || row.role, row.phone, row.hasPortalAccess ? "" : "No portal login yet"].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {isPro ? (
            <div className="flex flex-wrap items-center gap-2">
              {row.hasPortalAccess ? (
                <TechChatButton side="provider" contextType="general" employeeId={row.employeeId} label="Chat" variant="default" className="h-8" />
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!row.removable || removing === row.employeeId}
                title={removeLockHint(row, locked)}
                onClick={() => void removeEmployee(row)}
              >
                {removing === row.employeeId ? (
                  <Loader2 className="animate-spin" />
                ) : !row.removable ? (
                  <Lock className="size-3.5" />
                ) : null}
                {removing === row.employeeId ? "Removing…" : "Remove"}
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      {contractors.length ? (
        <div className="rounded-lg border border-input bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <Handshake className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Contractors · {contractors.length}
            </p>
          </div>
          <ul className="mt-2 flex flex-col divide-y divide-border-soft">
            {contractors.map((row) => (
              <li key={row.contractorId} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {isPro ? (
                    <Link href={`/pro/dashboard/contractors/${row.contractorId}`} className="text-sm font-semibold hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold">{row.name}</span>
                  )}
                  {row.title ? <span className="text-sm text-foreground">· {row.title}</span> : null}
                  <WorkState member={row} />
                  {isPro ? (
                    <span className="ml-auto flex items-center gap-1.5">
                      {row.hasPortalAccess ? (
                        <TechChatButton side="provider" contextType="general" contractorId={row.contractorId} label="Chat" className="h-7" />
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label={`Edit ${row.name}`}
                        disabled={locked}
                        title={locked ? removeLockHint(row, locked) : undefined}
                        onClick={() => setEditing(row)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${row.name}`}
                        disabled={!row.removable || removing === row.contractorId}
                        title={removeLockHint(row, locked)}
                        onClick={() => void removeContractor(row)}
                      >
                        {removing === row.contractorId ? <Loader2 className="animate-spin" /> : row.removable ? <Trash2 /> : <Lock />}
                      </Button>
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[row.trade, windowLabel(row), isPro ? termsLabel(row) : ""].filter(Boolean).join(" · ")}
                </p>
                {row.instructions ? <p className="line-clamp-2 text-xs text-muted-foreground">{row.instructions}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastActor && lastActor.type !== "provider" ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {order.status === "WORK_COMPLETED" || order.status === "SETTLED" ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          ) : (
            <MapPin className="size-3.5 text-primary" />
          )}
          Last update by {lastActor.name} ({lastActor.type === "contractor" ? "contractor" : "employee"}).
        </p>
      ) : null}

      {isPro ? (
        <AssignContractorDialog
          job={orderAssignTarget(order)}
          recordLabel="order"
          open={Boolean(editing)}
          onOpenChange={(next) => !next && setEditing(null)}
          existing={editing ? toAssignment(editing) : null}
          assign={(input) => assignOrderContractor(order.id, input)}
          onSaved={onChanged}
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Completion review (Pro) ───────────────────────────── */

function reviewDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

/* ───────────────────────────── Invoice (Pro) ───────────────────────────── */

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

/**
 * Pro order header: "Convert to invoice" once the completed work is approved (same as a job), then
 * "View invoice" — the Pro sends it from the invoice page, the customer pays it, then signs off.
 */
export function OrderInvoiceAction({ order, onChanged }: { order: ProviderOrder; onChanged: () => void | Promise<void> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (order.invoice) {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
        <Link href={`/pro/dashboard/invoices/${order.invoice.id}`}>
          <FileText className="size-3.5" /> {order.invoice.number || "Invoice"} ·{" "}
          {INVOICE_STATUS_LABEL[order.invoice.status] || order.invoice.status}
        </Link>
      </Button>
    );
  }
  if (order.status !== "WORK_COMPLETED") return null;
  async function convert() {
    if (busy) return;
    setBusy(true);
    try {
      const invoice = await convertOrderToInvoice(order.id);
      toast.success(`Invoice ${invoice.number} created. Review it and send it to the customer.`);
      await onChanged();
      if (invoice.id) router.push(`/pro/dashboard/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(errorText(err, "Could not create the invoice."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" className="h-8 gap-1.5 bg-[#003F7D] text-xs text-white hover:bg-[#003F7D]/90" disabled={busy} onClick={() => void convert()}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      Convert to invoice
    </Button>
  );
}

/** Crew portal: where their "Mark complete" stands (same wording as a job). */
export function CrewCompletionBanner({ order }: { order: ProviderOrder }) {
  const submission = order.crewCompletion;
  if (!submission || submission.status === "none" || submission.status === "approved") return null;
  if (submission.status === "pending") {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
        <p className="text-sm font-semibold">Waiting for office approval</p>
        <p className="mt-0.5 text-sm">
          You submitted completion proof{submission.submittedAt ? ` on ${reviewDate(submission.submittedAt)}` : ""}. You&apos;ll be
          notified when the office reviews it.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-950">
      <p className="text-sm font-semibold">Re-work requested</p>
      <p className="mt-0.5 text-sm">
        {submission.reviewNote ? `The office: "${submission.reviewNote}". ` : ""}Fix it, then press Mark complete again with new photos.
      </p>
    </div>
  );
}
