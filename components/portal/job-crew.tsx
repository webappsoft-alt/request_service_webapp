"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Handshake, Loader2, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignJobContractor,
  getJobContractorPay,
  recordContractorPayout,
  removeJobContractor,
  type ContractorPayRow,
  type ContractorPayoutInput,
} from "@/lib/api/contractor-portal-client";
import { formatMoney } from "@/lib/format";
import type { Job, JobContractorAssignment } from "@/lib/types";

function errorText(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return message || fallback;
}

function termsLabel(row: Pick<JobContractorAssignment, "payType" | "payRate">) {
  return row.payType === "fixed" ? `Fixed ${formatMoney(row.payRate)}` : `${formatMoney(row.payRate)}/hr`;
}

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
function toLocalInput(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Default window: the job's start day (or today), 8 AM – 5 PM. */
function defaultWindow(job: Job) {
  const base = job.scheduledAt ? new Date(job.scheduledAt) : new Date();
  const start = new Date(base);
  start.setHours(8, 0, 0, 0);
  const end = new Date(job.dueAt ? new Date(job.dueAt) : base);
  end.setHours(17, 0, 0, 0);
  if (end <= start) end.setTime(start.getTime() + 9 * 3600000);
  return { start: toLocalInput(start), end: toLocalInput(end) };
}

function windowLabel(row: Pick<JobContractorAssignment, "startAt" | "endAt">) {
  if (!row.startAt) return "";
  const fmt = (value: string) =>
    new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return row.endAt ? `${fmt(row.startAt)} → ${fmt(row.endAt)}` : fmt(row.startAt);
}

/* ───────────────────────────── Assign contractor dialog ───────────────────────────── */

/**
 * Assign an outside contractor to a job — separate from the technician
 * assignment. Pick a contractor, give their part a title and scope, and set
 * when they work. Pass `existing` to edit an assignment.
 */
export function AssignContractorDialog({
  job,
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: JobContractorAssignment | null;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AssignContractorForm
          key={existing?.contractorId || "new"}
          job={job}
          existing={existing ?? null}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function AssignContractorForm({
  job,
  existing,
  onOpenChange,
  onSaved,
}: {
  job: Job;
  existing: JobContractorAssignment | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const paging = usePaginatedCrmOptions(existing ? null : "contractor", !existing);
  const initial = existing?.startAt
    ? { start: toLocalInput(existing.startAt), end: existing.endAt ? toLocalInput(existing.endAt) : "" }
    : defaultWindow(job);
  const [contractorId, setContractorId] = useState(existing?.contractorId || "");
  const [contractorLabel, setContractorLabel] = useState(existing?.name || "");
  const [title, setTitle] = useState(existing?.title || job.title || "");
  const [instructions, setInstructions] = useState(existing?.instructions || "");
  const [startAt, setStartAt] = useState(initial.start);
  const [endAt, setEndAt] = useState(initial.end);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const alreadyOnJob = !existing && (job.crewContractors || []).some((row) => row.contractorId === contractorId);
  const errors = {
    contractor: !contractorId ? "Choose a contractor." : alreadyOnJob ? "This contractor is already on the job — edit them instead." : null,
    title: !title.trim() ? "Add a title." : null,
    start: !startAt ? "Choose a start." : null,
    end: !endAt ? "Choose an end." : startAt && endAt <= startAt ? "End must be after the start." : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function save() {
    setTouched(true);
    if (hasErrors || saving) return;
    setSaving(true);
    try {
      await assignJobContractor(job.id, {
        contractorId,
        title: title.trim(),
        instructions: instructions.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      });
      toast.success(existing ? `${contractorLabel || "Contractor"} updated.` : `${contractorLabel || "Contractor"} assigned to ${job.number}.`);
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorText(error, "Could not assign the contractor."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg" data-lenis-prevent onInteractOutside={(event) => saving && event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{existing ? "Edit contractor" : "Assign contractor"} · {job.number}</DialogTitle>
        <DialogDescription>
          Outside contractors are assigned separately from your technicians. They see this title, scope and time in their portal. Pay uses the rate on the contractor&apos;s profile.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field data-invalid={touched && errors.contractor ? true : undefined}>
          <FieldLabel htmlFor="job-contractor">Contractor</FieldLabel>
          {existing ? (
            <Input id="job-contractor" value={existing.name} disabled />
          ) : (
            <PaginatedEntitySelect
              id="job-contractor"
              value={contractorId}
              selectedLabel={contractorLabel}
              options={paging.options}
              placeholder="Select contractor"
              emptyLabel="No contractors found."
              loading={paging.loading}
              loadingMore={paging.loadingMore}
              hasMore={paging.hasMore}
              onLoadMore={paging.loadMore}
              searchable
              searchValue={paging.search}
              onSearchChange={paging.setSearch}
              searchPlaceholder="Search contractors…"
              onChange={(id, option) => {
                setContractorId(id);
                setContractorLabel(option?.label || "");
              }}
            />
          )}
          {touched && errors.contractor ? <FieldError>{errors.contractor}</FieldError> : null}
        </Field>

        <Field data-invalid={touched && errors.title ? true : undefined}>
          <FieldLabel htmlFor="job-contractor-title">Title</FieldLabel>
          <Input
            id="job-contractor-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Electrical rough-in"
          />
          {touched && errors.title ? <FieldError>{errors.title}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="job-contractor-scope">Description / instructions</FieldLabel>
          <Textarea
            id="job-contractor-scope"
            rows={3}
            maxLength={4000}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="What this contractor is responsible for on this job"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={touched && errors.start ? true : undefined}>
            <FieldLabel htmlFor="job-contractor-start">Start</FieldLabel>
            <Input id="job-contractor-start" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
            {touched && errors.start ? <FieldError>{errors.start}</FieldError> : null}
          </Field>
          <Field data-invalid={touched && errors.end ? true : undefined}>
            <FieldLabel htmlFor="job-contractor-end">End</FieldLabel>
            <Input
              id="job-contractor-end"
              type="datetime-local"
              value={endAt}
              min={startAt || undefined}
              onChange={(event) => setEndAt(event.target.value)}
            />
            {touched && errors.end ? <FieldError>{errors.end}</FieldError> : null}
          </Field>
        </div>

      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Handshake />}
          {existing ? "Save changes" : "Assign contractor"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ───────────────────────────── Pay dialog ───────────────────────────── */

/** Pro pays a contractor for approved work on one job (never more than the balance). */
export function PayContractorDialog({
  open,
  onOpenChange,
  contractorId,
  contractorName,
  row,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId: string;
  contractorName: string;
  row: ContractorPayRow | null;
  onPaid: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && row ? (
        <PayForm
          key={row.jobId}
          contractorId={contractorId}
          contractorName={contractorName}
          row={row}
          onOpenChange={onOpenChange}
          onPaid={onPaid}
        />
      ) : null}
    </Dialog>
  );
}

function PayForm({
  contractorId,
  contractorName,
  row,
  onOpenChange,
  onPaid,
}: {
  contractorId: string;
  contractorName: string;
  row: ContractorPayRow;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(row.balance.toFixed(2));
  const [method, setMethod] = useState<ContractorPayoutInput["method"]>("ach");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const value = Number(amount);
  const amountError =
    !(value > 0) ? "Enter an amount." : value > row.balance + 0.004 ? `No more than ${formatMoney(row.balance)}.` : null;

  async function pay() {
    if (amountError || saving) return;
    setSaving(true);
    try {
      await recordContractorPayout({
        contractorId,
        jobId: row.jobId,
        amount: Math.round(value * 100) / 100,
        method,
        paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
        reference: reference.trim(),
        notes: notes.trim(),
      });
      toast.success(`${formatMoney(value)} paid to ${contractorName}.`);
      await onPaid();
      onOpenChange(false);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
      toast.error(message || "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Pay {contractorName}</DialogTitle>
        <DialogDescription>
          {row.number}
          {row.title ? ` · ${row.title}` : ""}. Earned {formatMoney(row.earned)}, paid {formatMoney(row.paid)}.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={amountError ? true : undefined}>
            <FieldLabel htmlFor="pay-amount">Amount</FieldLabel>
            <Input id="pay-amount" type="number" min={0.01} step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            {amountError ? <FieldError>{amountError}</FieldError> : <FieldDescription>Balance {formatMoney(row.balance)}</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-method">Method</FieldLabel>
            <Select value={method} onValueChange={(value) => setMethod(value as ContractorPayoutInput["method"])}>
              <SelectTrigger id="pay-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ach">Bank transfer (ACH)</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pay-date">Paid on</FieldLabel>
            <Input id="pay-date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-ref">Reference</FieldLabel>
            <Input id="pay-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Check # / transfer ID" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pay-notes">Notes</FieldLabel>
          <Textarea id="pay-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void pay()} disabled={saving || Boolean(amountError)}>
          {saving ? <Loader2 className="animate-spin" /> : <Wallet />}
          Record payment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ───────────────────────────── Contractors card ───────────────────────────── */

function PayChip({ row }: { row: ContractorPayRow | undefined }) {
  if (!row) return null;
  if (row.earned > 0 && row.balance <= 0) return <StatusPill tone="success" label="Paid" />;
  if (row.paid > 0) return <StatusPill tone="primary" label={`${formatMoney(row.balance)} due`} />;
  if (row.approved) return <StatusPill tone="warning" label={`${formatMoney(row.balance)} to pay`} />;
  if (row.completion === "pending_pro_approval") return <StatusPill tone="warning" label="Awaiting review" />;
  return null;
}

/**
 * Job summary: outside contractors on the job (shown only when there are any),
 * each with their title, time, pay status, chat, edit, remove and Pay.
 */
export function JobContractorsCard({
  job,
  onChanged,
  locked = false,
}: {
  job: Job;
  onChanged: () => void | Promise<void>;
  /** Completed job — the crew can no longer be edited or removed (paying still works). */
  locked?: boolean;
}) {
  const contractors = job.crewContractors || [];
  const [editing, setEditing] = useState<JobContractorAssignment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [payRows, setPayRows] = useState<Array<ContractorPayRow & { contractorId: string }>>([]);
  const [paying, setPaying] = useState<{ contractorId: string; name: string; row: ContractorPayRow } | null>(null);
  const contractorKey = contractors.map((row) => row.contractorId).join(",");
  /** Bumped after a payment / change so pay status reloads. */
  const [payVersion, setPayVersion] = useState(0);
  const reloadPay = () => setPayVersion((v) => v + 1);

  useEffect(() => {
    if (!contractorKey) return;
    let cancelled = false;
    getJobContractorPay(job.id)
      .then((rows) => {
        if (!cancelled) setPayRows(rows);
      })
      .catch(() => {
        // Pay status is supplementary; the list still renders.
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, contractorKey, payVersion]);

  async function remove(row: JobContractorAssignment) {
    if (removing) return;
    if (!window.confirm(`Remove ${row.name} from ${job.number}?`)) return;
    setRemoving(row.contractorId);
    try {
      await removeJobContractor(job.id, row.contractorId);
      toast.success(`${row.name} removed from this job.`);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error, "Could not remove the contractor."));
    } finally {
      setRemoving(null);
    }
  }

  if (!contractors.length) return null;

  return (
    <div className="rounded-lg border border-input bg-background px-4 py-3">
      <div className="flex items-center gap-2">
        <Handshake className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Contractors · {contractors.length}
        </p>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-border-soft">
        {contractors.map((row) => {
          const pay = payRows.find((item) => item.contractorId === row.contractorId);
          return (
            <li key={row.contractorId} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/pro/dashboard/contractors/${row.contractorId}`} className="text-sm font-semibold hover:underline">
                  {row.name}
                </Link>
                {row.title ? <span className="text-sm text-foreground">· {row.title}</span> : null}
                <PayChip row={pay} />
                <span className="ml-auto flex items-center gap-1.5">
                  {row.hasPortalAccess ? (
                    <TechChatButton side="provider" contextType="job" contextId={job.id} contractorId={row.contractorId} label="Chat" className="h-7" />
                  ) : null}
                  {pay?.payable ? (
                    <Button size="sm" className="h-7" onClick={() => setPaying({ contractorId: row.contractorId, name: row.name, row: pay })}>
                      <Wallet /> Pay
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${row.name}`} disabled={locked} title={locked ? "This job is completed" : undefined} onClick={() => setEditing(row)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${row.name}`}
                    disabled={locked || removing === row.contractorId}
                    title={locked ? "This job is completed" : undefined}
                    onClick={() => void remove(row)}
                  >
                    {removing === row.contractorId ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {[row.trade, windowLabel(row), termsLabel(row)].filter(Boolean).join(" · ")}
              </p>
              {row.instructions ? <p className="line-clamp-2 text-xs text-muted-foreground">{row.instructions}</p> : null}
            </li>
          );
        })}
      </ul>

      <AssignContractorDialog
        job={job}
        open={Boolean(editing)}
        onOpenChange={(next) => !next && setEditing(null)}
        existing={editing}
        onSaved={async () => {
          await onChanged();
          reloadPay();
        }}
      />
      <PayContractorDialog
        open={Boolean(paying)}
        onOpenChange={(next) => !next && setPaying(null)}
        contractorId={paying?.contractorId || ""}
        contractorName={paying?.name || ""}
        row={paying?.row || null}
        onPaid={reloadPay}
      />
    </div>
  );
}
