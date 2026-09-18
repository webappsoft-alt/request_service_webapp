"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  jobCostKindLabel,
  jobCostMix,
  lineTotal,
  useJobCosting,
  type JobCostKind,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { formatMoney } from "@/lib/format";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABOR = "#003F7D";
const MATERIALS = "#5b8fa8";
const RING = 2 * Math.PI * 54;

const MATERIAL_UNITS = [
  { value: "ea", label: "Each" },
  { value: "ft", label: "Feet" },
  { value: "sq ft", label: "Square feet" },
] as const;

const LABOR_UNITS = [
  { value: "hr", label: "Hour" },
] as const;

export function JobCostChart({ labor, materials }: { labor: number; materials: number }) {
  const total = labor + materials;
  const laborShare = total ? labor / total : 0;
  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e6ebf0" strokeWidth="16" />
        {total > 0 ? (
          <>
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={MATERIALS}
              strokeWidth="16"
              strokeDasharray={`${RING * (1 - laborShare)} ${RING}`}
              strokeDashoffset={-RING * laborShare}
              strokeLinecap="butt"
            />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={LABOR}
              strokeWidth="16"
              strokeDasharray={`${RING * laborShare} ${RING}`}
              strokeLinecap="butt"
            />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Total</p>
        <p className="text-lg font-semibold tabular-nums">{formatMoney(total)}</p>
      </div>
    </div>
  );
}

export type CostingNoun = "job" | "estimate" | "invoice";

function costingHint(noun: CostingNoun, locked: boolean) {
  switch (noun) {
    case "estimate":
      return locked ? "This quote is converted. Qty and price are locked." : "Add or edit lines until this quote becomes a job.";
    case "invoice":
      return locked ? "This invoice has left draft. Qty and price are locked." : "Add or edit lines until this invoice is sent.";
    case "job":
      return locked ? "This job is invoiced. Qty and price are locked." : "Add or edit lines until the job is invoiced.";
    default: {
      const _never: never = noun;
      return _never;
    }
  }
}

export function JobCosting({
  job,
  locked = false,
  noun = "job",
  onMutate,
  onSave,
}: {
  job: Job;
  locked?: boolean;
  noun?: CostingNoun;
  onMutate?: (title: string, detail: string) => void;
  onSave?: (lines: JobCostLine[]) => void | Promise<void>;
}) {
  const { lines, commit } = useJobCosting(job);
  const [draft, setDraft] = useState<JobCostLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);

  const activeLines = draft ?? lines;
  const mix = useMemo(() => jobCostMix(activeLines), [activeLines]);

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (draft.length !== lines.length) return true;
    for (let i = 0; i < draft.length; i++) {
      const a = draft[i];
      const b = lines[i];
      if (!b) return true;
      if (
        a.id !== b.id ||
        (a.description || "").trim() !== (b.description || "").trim() ||
        a.kind !== b.kind ||
        a.quantity !== b.quantity ||
        (a.unit || "") !== (b.unit || "") ||
        a.unitPrice !== b.unitPrice
      ) {
        return true;
      }
    }
    return false;
  }, [draft, lines]);

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

      // Allow clicks within the job costing form, modals, dropdowns, selects, toasts
      if (
        target.closest("[data-job-costing-form]") ||
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

      const interactiveEl = target.closest(
        "button, a[href], [role='tab'], [role='button'], [data-tab-id]"
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

  function add(kind: JobCostKind) {
    if (locked) return;
    const stamp = Date.now();
    const newLine: JobCostLine = {
      id: `extra_${kind}_${stamp}`,
      description: "",
      kind,
      quantity: 1,
      unit: kind === "labor" ? "hr" : "ea",
      unitPrice: 0,
    };
    setDraft((prev) => [...(prev ?? lines), newLine]);
  }

  function change(id: string, patch: Partial<JobCostLine>) {
    if (locked) return;
    setDraft((prev) => (prev ?? lines).map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function remove(id: string) {
    if (locked) return;
    setDraft((prev) => (prev ?? lines).filter((line) => line.id !== id));
  }

  async function persist(nextLines: JobCostLine[]) {
    commit(nextLines);
    setDraft(null);
    if (onSave) {
      await onSave(nextLines);
    }
    onMutate?.("Cost lines updated", `${nextLines.length} items on file`);
  }

  async function handleManualSave() {
    try {
      setSaving(true);
      await persist(activeLines);
      toast.success("Line items saved.");
    } catch {
      // error handled by onSave
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndLeave() {
    await persist(activeLines);
    toast.success("Line items saved.");
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

  return (
    <div data-job-costing-form>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Labor and materials</h2>
          <p className="mt-1 text-sm text-muted-foreground">{costingHint(noun, locked)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 self-end md:self-auto">
          <Button size="sm" variant="outline" disabled={locked || saving} onClick={() => add("labor")}>
            <Plus />
            Add labor
          </Button>
          <Button size="sm" variant="outline" disabled={locked || saving} onClick={() => add("materials")}>
            <Plus />
            Add material
          </Button>
          {locked ? null : (
            <Button
              size="sm"
              disabled={saving}
              onClick={handleManualSave}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {saving ? "Saving…" : "Save line items"}
            </Button>
          )}
        </div>
      </div>
      <div className="w-full overflow-x-auto rounded-[4px] border border-black/10">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Description</TableHead>
              <TableHead className="w-32 min-w-[125px]">Type</TableHead>
              <TableHead className="w-24 min-w-[90px]">Qty</TableHead>
              <TableHead className="w-36 min-w-[135px]">Unit</TableHead>
              <TableHead className="w-28 min-w-[110px]">Price</TableHead>
              <TableHead className="w-24 min-w-[95px] text-right">Total</TableHead>
              <TableHead className="w-10 min-w-[44px]">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeLines.map((line) => (
              <CostRow
                key={line.id}
                line={line}
                locked={locked}
                onChange={change}
                onRemove={!locked ? () => remove(line.id) : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Labor</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.labor)}</dd>
        <dt className="text-muted-foreground">Materials</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.materials)}</dd>
        <dt className="font-medium">{noun === "estimate" ? "Quote total" : noun === "invoice" ? "Invoice total" : "Job total"}</dt>
        <dd className="text-right font-semibold tabular-nums">{formatMoney(mix.total)}</dd>
      </dl>

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

function CostRow({
  line,
  locked,
  onChange,
  onRemove,
}: {
  line: JobCostLine;
  locked: boolean;
  onChange: (id: string, patch: Partial<JobCostLine>) => void;
  onRemove?: (id: string) => void;
}) {
  const currentUnit =
    line.kind === "labor"
      ? "hr"
      : line.unit && ["ea", "ft", "sq ft"].includes(line.unit)
        ? line.unit
        : "ea";
  const unitOptions = line.kind === "labor" ? LABOR_UNITS : MATERIAL_UNITS;

  return (
    <TableRow>
      <TableCell className="min-w-[220px]">
        <Input
          aria-label="Description"
          disabled={locked}
          placeholder={line.kind === "labor" ? "Additional labor" : "Additional material"}
          value={line.description}
          onChange={(event) => onChange(line.id, { description: event.target.value })}
          className="w-full"
        />
      </TableCell>
      <TableCell className="w-32 min-w-[125px]">
        <Select
          disabled={locked}
          value={line.kind}
          onValueChange={(value) => {
            const kind = value as JobCostKind;
            const unit = kind === "labor" ? "hr" : line.unit === "hr" || !line.unit ? "ea" : line.unit;
            onChange(line.id, { kind, unit });
          }}
        >
          <SelectTrigger aria-label="Type" className="w-full">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="z-[100] w-[var(--radix-select-trigger-width)]">
            <SelectItem value="labor">Labor</SelectItem>
            <SelectItem value="materials">Materials</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-24 min-w-[90px]">
        <Input
          aria-label="Quantity"
          className="w-full tabular-nums"
          disabled={locked}
          inputMode="decimal"
          min={0}
          step="any"
          type="number"
          value={Number.isFinite(line.quantity) ? line.quantity : 0}
          onChange={(event) => onChange(line.id, { quantity: Number(event.target.value) || 0 })}
        />
      </TableCell>
      <TableCell className="w-36 min-w-[135px]">
        <Select
          disabled={locked}
          value={currentUnit}
          onValueChange={(unit) => onChange(line.id, { unit })}
        >
          <SelectTrigger aria-label="Unit" className="w-full">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="z-[100] w-[var(--radix-select-trigger-width)]">
            {unitOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-28 min-w-[110px]">
        <Input
          aria-label="Unit price"
          className="w-full tabular-nums"
          disabled={locked}
          inputMode="decimal"
          min={0}
          placeholder="0"
          step="0.01"
          type="number"
          value={line.unitPrice ? line.unitPrice : ""}
          onChange={(event) => onChange(line.id, { unitPrice: Number(event.target.value) || 0 })}
        />
      </TableCell>
      <TableCell className="w-24 min-w-[95px] text-right font-medium tabular-nums">{formatMoney(lineTotal(line))}</TableCell>
      <TableCell className="w-10 min-w-[44px] text-center">
        {onRemove ? (
          <Button
            aria-label={`Remove ${line.description || jobCostKindLabel(line.kind)}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={() => onRemove(line.id)}
          >
            <Trash2 />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function EstimateCostChart({ labor, materials }: { labor: number; materials: number }) {
  const total = labor + materials;
  const laborPct = total ? Math.round((labor / total) * 100) : 0;
  const materialPct = total ? 100 - laborPct : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <EstimateMixTile label="Labor" amount={labor} percent={laborPct} color={LABOR} />
        <EstimateMixTile label="Materials" amount={materials} percent={materialPct} color={MATERIALS} />
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[#e6ebf0]" aria-hidden="true">
        <div className="h-full bg-[#003F7D]" style={{ width: `${laborPct}%` }} />
        <div className="h-full bg-[#5b8fa8]" style={{ width: `${materialPct}%` }} />
      </div>
      <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Quote</p>
        <p className="text-xl font-semibold tabular-nums text-[#003F7D]">{formatMoney(total)}</p>
      </div>
    </div>
  );
}

function EstimateMixTile({
  label,
  amount,
  percent,
  color,
}: {
  label: string;
  amount: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="rounded-[4px] border border-black/8 bg-[#f7f9fb] px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-[#003F7D]">{formatMoney(amount)}</p>
      <p className="text-xs text-muted-foreground">{percent}% of quote</p>
    </div>
  );
}

export function JobCostLegend({
  labor,
  materials,
}: {
  labor: number;
  materials: number;
}) {
  const total = labor + materials;
  return (
    <ul className="w-full space-y-3 text-sm">
      <MixLegend color={LABOR} label="Labor" amount={labor} share={total ? Math.round((labor / total) * 100) : 0} />
      <MixLegend
        color={MATERIALS}
        label="Materials"
        amount={materials}
        share={total ? Math.round((materials / total) * 100) : 0}
      />
    </ul>
  );
}

function MixLegend({
  color,
  label,
  amount,
  share,
}: {
  color: string;
  label: string;
  amount: number;
  share: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full")} style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {share}% · <span className="font-medium text-foreground">{formatMoney(amount)}</span>
      </span>
    </li>
  );
}
